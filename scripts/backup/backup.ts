#!/usr/bin/env tsx
/**
 * Soker ERP — automated PostgreSQL backup
 *
 * Flow (plain format):
 *   pg_dump → gzip → .sql.gz
 *   gunzip -t (integrity check)
 *   gpg AES-256 → .sql.gz.gpg
 *   upload to R2 (daily/ + weekly/ + monthly/ as applicable)
 *   verify R2 object size
 *   cleanup local temp files
 *   apply retention policy
 *   send webhook notification
 *
 * UPGRADE PATH → custom format (-Fc):
 *   Set BACKUP_FORMAT=custom in env.
 *   pg_dump will write binary directly (-Fc already compressed).
 *   The gzip step is skipped; GPG encrypts the .dump file directly.
 *   Parallel restore with pg_restore -j becomes possible.
 *   No other code changes needed.
 */

import { spawn } from "child_process";
import { createGzip } from "zlib";
import { createReadStream, createWriteStream } from "fs";
import { unlink, stat } from "fs/promises";
import { join } from "path";
import { pipeline } from "stream/promises";
import { execFile } from "child_process";
import { promisify } from "util";

import { loadConfig } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { createR2Client, uploadFile, verifyObject } from "./lib/r2.js";
import { encryptFile } from "./lib/encrypt.js";
import { notify } from "./lib/notify.js";
import { withRetry } from "./lib/retry.js";
import { applyRetention, determineCategories, PREFIXES } from "./lib/retention.js";

const execFileAsync = promisify(execFile);

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function nowTag(): string {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}`
  );
}

async function safeUnlink(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      await unlink(p);
    } catch {
      // Already gone — fine
    }
  }
}

// --------------------------------------------------------------------------
// pg_dump (plain format, streamed through gzip)
// --------------------------------------------------------------------------

async function dumpPlain(
  databaseUrl: string,
  outputPath: string // .sql.gz
): Promise<void> {
  logger.info("pgdump.start", { format: "plain", outputPath });

  const args = [
    "--no-owner",
    "--no-acl",
    "--clean",
    "--if-exists",
    "--format=plain",
    databaseUrl, // last positional arg
  ];

  await new Promise<void>((resolve, reject) => {
    const pgdump = spawn("pg_dump", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderrBuf = "";
    pgdump.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    const gz = createGzip({ level: 6 });
    const out = createWriteStream(outputPath);

    // Pipe: pg_dump stdout → gzip → file
    pipeline(pgdump.stdout!, gz, out).catch(reject);

    pgdump.on("error", (err) => {
      reject(new Error(`pg_dump spawn error: ${err.message}`));
    });

    pgdump.on("close", (code) => {
      if (code !== 0) {
        // Mask any credentials that might appear in stderr
        const safeStderr = stderrBuf.replace(/postgresql:\/\/[^@\s]+@/g, "postgresql://***@");
        reject(new Error(`pg_dump exited with code ${code}: ${safeStderr}`));
        return;
      }
      if (stderrBuf.trim()) {
        logger.warn("pgdump.stderr", { lines: stderrBuf.trim().split("\n").length });
      }
      // The pipeline resolves independently — process exit doesn't mean write is done.
      // We wait for the 'finish' event on the output stream.
      out.on("finish", resolve);
      out.on("error", reject);
    });
  });

  const { size } = await stat(outputPath);
  logger.info("pgdump.done", { outputPath, bytes: size });
}

// --------------------------------------------------------------------------
// pg_dump (custom format — for future use when DB grows)
// --------------------------------------------------------------------------

async function dumpCustom(
  databaseUrl: string,
  outputPath: string, // .dump
  parallelJobs: number
): Promise<void> {
  logger.info("pgdump.start", { format: "custom", outputPath, parallelJobs });

  const args = [
    "--no-owner",
    "--no-acl",
    "--clean",
    "--if-exists",
    "--format=custom",
    `--file=${outputPath}`,
    ...(parallelJobs > 1 ? [`--jobs=${parallelJobs}`] : []),
    databaseUrl,
  ];

  const { stdout, stderr } = await execFileAsync("pg_dump", args).catch(
    (err: NodeJS.ErrnoException & { code?: number; stderr?: string }) => {
      const safeStderr = (err.stderr ?? "").replace(
        /postgresql:\/\/[^@\s]+@/g,
        "postgresql://***@"
      );
      throw new Error(`pg_dump exited with code ${err.code}: ${safeStderr}`);
    }
  );

  if (stderr?.trim()) logger.warn("pgdump.stderr", { lines: stderr.split("\n").length });

  const { size } = await stat(outputPath);
  logger.info("pgdump.done", { outputPath, bytes: size });
}

// --------------------------------------------------------------------------
// Integrity check
// --------------------------------------------------------------------------

async function verifyGzip(filePath: string): Promise<void> {
  logger.info("verify.gzip_start", { filePath });
  try {
    await execFileAsync("gunzip", ["--test", filePath]);
    logger.info("verify.gzip_ok", { filePath });
  } catch (err) {
    throw new Error(`Gzip integrity check failed for "${filePath}": ${err}`);
  }
}

async function assertNonEmpty(filePath: string): Promise<number> {
  const { size } = await stat(filePath);
  if (size === 0) throw new Error(`Dump file is empty: ${filePath}`);
  return size;
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  const startMs = Date.now();
  const now = new Date();

  logger.info("backup.start", { utc: now.toISOString() });

  // 1. Load & validate config
  const config = loadConfig();
  const r2 = createR2Client({
    accountId: config.r2AccountId,
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
  });

  const tag = nowTag();
  const categories = determineCategories(now);
  logger.info("backup.categories", { categories, tag });

  // 2. File paths (all in tempDir)
  const isPlain = config.format === "plain";
  const dumpExt = isPlain ? "sql.gz" : "dump";
  const dumpPath = join(config.tempDir, `backup-${tag}.${dumpExt}`);
  const encPath = `${dumpPath}.gpg`;

  let uploadedBytes = 0;
  let firstKey = "";

  try {
    // 3. Create dump
    if (isPlain) {
      await dumpPlain(config.databaseUrl, dumpPath);
    } else {
      await dumpCustom(config.databaseUrl, dumpPath, config.parallelJobs);
    }

    // 4. Verify dump is non-empty
    const dumpSize = await assertNonEmpty(dumpPath);

    // 5. Integrity check (gzip only for plain format)
    if (isPlain) {
      await verifyGzip(dumpPath);
    }

    // 6. GPG encrypt
    await encryptFile(dumpPath, encPath, config.gpgPassphrase);
    await safeUnlink(dumpPath); // clean intermediate file

    const encSize = await assertNonEmpty(encPath);

    // 7. Upload to each applicable R2 prefix (with retry)
    for (const cat of categories) {
      const key = `${PREFIXES[cat]}backup-${tag}.${dumpExt}.gpg`;
      if (!firstKey) firstKey = key;

      await withRetry(
        async () => {
          const bytes = await uploadFile(r2, config.r2BucketName, key, encPath);
          await verifyObject(r2, config.r2BucketName, key, bytes);
          uploadedBytes = bytes;
        },
        { maxAttempts: 3, baseDelayMs: 2000, label: `upload(${key})` }
      );
    }

    // 8. Clean up local encrypted file
    await safeUnlink(encPath);

    // 9. Apply retention policy
    await applyRetention(r2, config.r2BucketName, config.retention);

    const durationMs = Date.now() - startMs;
    logger.info("backup.success", {
      key: firstKey,
      categories,
      bytes: uploadedBytes,
      durationMs,
    });

    // 10. Success notification
    await notify(config.alertWebhookUrl, {
      success: true,
      backupKey: firstKey,
      sizeBytes: uploadedBytes,
      durationMs,
    });

    process.exit(0);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const reason = err instanceof Error ? err.message : String(err);

    logger.error("backup.failed", { reason, durationMs });

    // Best-effort cleanup of any temp files
    await safeUnlink(dumpPath, encPath);

    await notify(config.alertWebhookUrl, {
      success: false,
      durationMs,
      errorReason: reason,
    });

    process.exit(1);
  }
}

main();
