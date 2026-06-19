#!/usr/bin/env tsx
/**
 * Manual restore helper — downloads the latest (or a specific) backup from R2,
 * decrypts it, decompresses it, and restores into a target PostgreSQL database.
 *
 * USAGE:
 *   # Restore latest daily backup to a target database
 *   RESTORE_TARGET_DB="postgresql://user:pass@host/dbname" \
 *   npx tsx scripts/backup/restore.ts
 *
 *   # Restore a specific backup key
 *   RESTORE_TARGET_DB="postgresql://..." \
 *   RESTORE_BACKUP_KEY="daily/backup-2026-06-18-02-00.sql.gz.gpg" \
 *   npx tsx scripts/backup/restore.ts
 *
 * WARNING: This REPLACES ALL DATA in RESTORE_TARGET_DB.
 *          NEVER point this at production unless you know what you're doing.
 *
 * Required env vars (in addition to the backup vars):
 *   RESTORE_TARGET_DB      — target database URL (NOT production)
 *   RESTORE_BACKUP_KEY     — (optional) specific R2 key; defaults to latest daily
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { unlink, stat } from "fs/promises";
import { join } from "path";
import { createGunzip } from "zlib";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";

import { loadConfig } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { createR2Client, listObjects, downloadObject } from "./lib/r2.js";
import { decryptFile } from "./lib/encrypt.js";
import { PREFIXES } from "./lib/retention.js";

const execFileAsync = promisify(execFile);

async function safeUnlink(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try { await unlink(p); } catch { /* already gone */ }
  }
}

async function findLatestKey(
  r2: ReturnType<typeof createR2Client>,
  bucket: string,
  prefix: string
): Promise<string> {
  const objects = await listObjects(r2, bucket, prefix);
  if (objects.length === 0)
    throw new Error(`No backups found under prefix "${prefix}" in bucket "${bucket}"`);

  objects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return objects[0].key;
}

async function main(): Promise<void> {
  const targetDb = process.env.RESTORE_TARGET_DB;
  if (!targetDb) {
    logger.error("restore.missing_target", {
      hint: "Set RESTORE_TARGET_DB to the database you want to restore into.",
    });
    process.exit(1);
  }

  const config = loadConfig();
  const r2 = createR2Client({
    accountId: config.r2AccountId,
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
  });

  // Determine which backup to restore
  const backupKey =
    process.env.RESTORE_BACKUP_KEY ??
    (await findLatestKey(r2, config.r2BucketName, PREFIXES.daily));

  logger.info("restore.target_key", { key: backupKey });

  // Detect format from key extension
  const isPlain = backupKey.includes(".sql.gz.gpg");
  const isCustom = backupKey.includes(".dump.gpg");
  if (!isPlain && !isCustom) {
    throw new Error(`Cannot determine format from key: ${backupKey}`);
  }

  const tmpDir = config.tempDir;
  const encFile = join(tmpDir, "restore_download.gpg");
  const decFile = join(tmpDir, isPlain ? "restore_decrypted.sql.gz" : "restore_decrypted.dump");
  const sqlFile = join(tmpDir, "restore_decrypted.sql");

  try {
    // 1. Download
    logger.info("restore.download_start", { key: backupKey });
    await downloadObject(r2, config.r2BucketName, backupKey, encFile);

    // 2. Decrypt
    await decryptFile(encFile, decFile, config.gpgPassphrase);
    await safeUnlink(encFile);

    // 3. Decompress (plain format only)
    let restoreSource = decFile;
    if (isPlain) {
      logger.info("restore.decompress_start", {});
      const gz = createGunzip();
      const out = createWriteStream(sqlFile);
      await pipeline(createReadStream(decFile), gz, out);
      await safeUnlink(decFile);
      restoreSource = sqlFile;
    }

    const { size } = await stat(restoreSource);
    logger.info("restore.file_ready", { path: restoreSource, bytes: size });

    // 4. Restore into target database
    logger.info("restore.psql_start", {});

    if (isPlain) {
      await execFileAsync("psql", [targetDb, "--file", restoreSource, "--echo-errors"]);
    } else {
      await execFileAsync("pg_restore", [
        "--no-owner",
        "--no-acl",
        "--clean",
        "--if-exists",
        "--dbname",
        targetDb,
        restoreSource,
      ]);
    }

    logger.info("restore.success", {});
  } finally {
    await safeUnlink(encFile, decFile, sqlFile);
  }

  process.exit(0);
}

main().catch((err) => {
  logger.error("restore.fatal", { error: String(err) });
  process.exit(1);
});
