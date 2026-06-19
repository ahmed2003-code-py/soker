#!/usr/bin/env tsx
/**
 * Automated restore integrity test.
 *
 * What it does (ALL in isolation — never touches production):
 *   1. Downloads the latest daily backup from R2
 *   2. Decrypts + decompresses it
 *   3. Restores into a throwaway embedded PostgreSQL instance (port 5499)
 *   4. Runs row-count sanity checks against expected minimums
 *   5. Reports PASS / FAIL clearly and exits non-zero on failure
 *   6. Tears down the temp DB regardless of outcome
 *
 * USAGE:
 *   npx tsx scripts/backup/test-restore.ts
 *
 *   # Override which backup to test
 *   RESTORE_BACKUP_KEY="daily/sokkar-daily-2026-06-18-0200.sql.gpg" \
 *   npx tsx scripts/backup/test-restore.ts
 *
 *   # Override minimum expected row counts (defaults are conservative)
 *   TEST_MIN_PARTIES=1 TEST_MIN_INVOICES=0 \
 *   npx tsx scripts/backup/test-restore.ts
 *
 * NOTE: Requires `embedded-postgres` (already in devDependencies).
 *       Also requires pg_dump / psql tools available in PATH.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createGunzip } from "zlib";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";

import EmbeddedPostgres from "embedded-postgres";

import { loadConfig } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { createR2Client, listObjects, downloadObject } from "./lib/r2.js";
import { decryptFile } from "./lib/encrypt.js";
import { PREFIXES } from "./lib/retention.js";

const execFileAsync = promisify(execFile);

const TEST_DB_PORT = 5499;
const TEST_DB_NAME = "soker_restore_test";
const TEST_DB_USER = "postgres";

/** Minimum row counts that a valid backup must contain. Override via env. */
const EXPECTATIONS = {
  parties: parseInt(process.env.TEST_MIN_PARTIES ?? "1", 10),
  invoices: parseInt(process.env.TEST_MIN_INVOICES ?? "0", 10),
  ledgerEntries: parseInt(process.env.TEST_MIN_LEDGER ?? "0", 10),
  treasuryAccounts: parseInt(process.env.TEST_MIN_TREASURY ?? "1", 10),
};

async function safeUnlink(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try { await unlink(p); } catch { /* already gone */ }
  }
}

async function findLatestKey(
  r2: ReturnType<typeof createR2Client>,
  bucket: string
): Promise<string> {
  const objects = await listObjects(r2, bucket, PREFIXES.daily);
  if (objects.length === 0)
    throw new Error(`No daily backups found in bucket "${bucket}"`);
  objects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return objects[0].key;
}

async function queryCount(
  dbUrl: string,
  table: string
): Promise<number> {
  const { stdout } = await execFileAsync("psql", [
    dbUrl,
    "--no-psqlrc",
    "--tuples-only",
    "--command",
    `SELECT COUNT(*) FROM "${table}";`,
  ]);
  return parseInt(stdout.trim(), 10);
}

async function main(): Promise<void> {
  logger.info("test_restore.start", {});

  const config = loadConfig();
  const r2 = createR2Client({
    accountId: config.r2AccountId,
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
  });

  // Build test DB URL (embedded postgres)
  const testDbUrl = `postgresql://${TEST_DB_USER}@localhost:${TEST_DB_PORT}/${TEST_DB_NAME}`;

  // Temp dir for intermediate files
  const tmpDir = await mkdtemp(join(tmpdir(), "soker-restore-test-"));
  const encFile = join(tmpDir, "backup.gpg");
  const decFile = join(tmpDir, "backup.sql.gz");
  const sqlFile = join(tmpDir, "backup.sql");

  // Embedded postgres instance (separate data dir, won't touch .localdb/)
  const pg = new EmbeddedPostgres({
    databaseDir: join(tmpDir, "pgdata"),
    user: TEST_DB_USER,
    port: TEST_DB_PORT,
    persistent: false,
  });

  const results: Array<{
    table: string;
    count: number;
    minExpected: number;
    pass: boolean;
  }> = [];

  let pgStarted = false;

  try {
    // 1. Determine backup to test
    const backupKey =
      process.env.RESTORE_BACKUP_KEY ??
      (await findLatestKey(r2, config.r2BucketName));
    logger.info("test_restore.key", { key: backupKey });

    // 2. Download from R2
    logger.info("test_restore.download", {});
    await downloadObject(r2, config.r2BucketName, backupKey, encFile);

    // 3. Decrypt
    await decryptFile(encFile, decFile, config.gpgPassphrase);
    await safeUnlink(encFile);

    // 4. Decompress
    logger.info("test_restore.decompress", {});
    await pipeline(createReadStream(decFile), createGunzip(), createWriteStream(sqlFile));
    await safeUnlink(decFile);

    // 5. Start embedded PostgreSQL
    logger.info("test_restore.pg_start", { port: TEST_DB_PORT });
    await pg.initialise();
    await pg.start();
    pgStarted = true;

    await pg.createDatabase(TEST_DB_NAME);

    // 6. Restore
    logger.info("test_restore.psql_restore", {});
    await execFileAsync("psql", [
      testDbUrl,
      "--file",
      sqlFile,
      "--quiet",
    ]);

    await safeUnlink(sqlFile);

    // 7. Validate row counts
    const checks: Array<{ table: string; key: keyof typeof EXPECTATIONS }> = [
      { table: "Party", key: "parties" },
      { table: "Invoice", key: "invoices" },
      { table: "LedgerEntry", key: "ledgerEntries" },
      { table: "TreasuryAccount", key: "treasuryAccounts" },
    ];

    for (const { table, key } of checks) {
      const count = await queryCount(testDbUrl, table);
      const minExpected = EXPECTATIONS[key];
      const pass = count >= minExpected;
      results.push({ table, count, minExpected, pass });
    }
  } finally {
    // Always clean up, even if test fails
    await safeUnlink(encFile, decFile, sqlFile);

    if (pgStarted) {
      try {
        await pg.stop();
      } catch (err) {
        logger.warn("test_restore.pg_stop_error", { error: String(err) });
      }
    }

    // Remove temp dir (best-effort)
    try {
      const { rm } = await import("fs/promises");
      await rm(tmpDir, { recursive: true, force: true });
    } catch { /* best effort */ }
  }

  // 8. Report results
  let allPassed = true;
  for (const r of results) {
    if (!r.pass) allPassed = false;
    logger.info("test_restore.check", {
      table: r.table,
      count: r.count,
      minExpected: r.minExpected,
      status: r.pass ? "PASS" : "FAIL",
    });
  }

  if (allPassed) {
    logger.info("test_restore.result", { status: "PASS", checks: results.length });
    process.stdout.write(
      "\n✅ RESTORE TEST PASSED — all row count checks met\n\n"
    );
    process.exit(0);
  } else {
    logger.error("test_restore.result", { status: "FAIL" });
    process.stderr.write(
      "\n❌ RESTORE TEST FAILED — see check results above\n\n"
    );
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("test_restore.fatal", { error: String(err) });
  process.exit(1);
});
