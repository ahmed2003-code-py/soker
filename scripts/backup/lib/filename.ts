/**
 * Canonical filename builder for all backup scripts.
 * All backup filename construction must go through here — one place to change.
 *
 * Format:  sokkar-{category}-{YYYY-MM-DD}-{HHmm}.{ext}.gpg
 * Example: sokkar-daily-2026-06-19-0200.sql.gpg
 */

import { join } from "path";

export type DumpFormat = "plain" | "custom";

/**
 * Compact UTC timestamp: "2026-06-19-0200"
 * YYYY-MM-DD-HHmm — no separator between hours and minutes to keep extension list short.
 */
export function buildTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`
  );
}

/**
 * R2 object filename (NOT the full key — caller prepends the prefix).
 * plain  → sokkar-daily-2026-06-19-0200.sql.gpg
 * custom → sokkar-daily-2026-06-19-0200.dump.gpg
 */
export function buildBackupFilename(
  category: string,
  date: Date,
  format: DumpFormat
): string {
  const ext = format === "plain" ? "sql.gpg" : "dump.gpg";
  return `sokkar-${category}-${buildTimestamp(date)}.${ext}`;
}

/**
 * Local temp path for the raw (unencrypted) dump.
 * plain  → /tmp/sokkar-2026-06-19-0200.sql.gz   (still gzip-compressed internally)
 * custom → /tmp/sokkar-2026-06-19-0200.dump
 */
export function buildTempDumpPath(
  dir: string,
  date: Date,
  format: DumpFormat
): string {
  const ext = format === "plain" ? "sql.gz" : "dump";
  return join(dir, `sokkar-${buildTimestamp(date)}.${ext}`);
}

/**
 * Local temp path for the GPG-encrypted file (before upload).
 * plain  → /tmp/sokkar-2026-06-19-0200.sql.gpg
 * custom → /tmp/sokkar-2026-06-19-0200.dump.gpg
 */
export function buildTempEncPath(
  dir: string,
  date: Date,
  format: DumpFormat
): string {
  const ext = format === "plain" ? "sql.gpg" : "dump.gpg";
  return join(dir, `sokkar-${buildTimestamp(date)}.${ext}`);
}

/**
 * Detect the dump format from an R2 key.
 * Supports both new format (.sql.gpg) and legacy format (.sql.gz.gpg) for restoring
 * backups that were uploaded before this naming change.
 */
export function detectDumpFormat(key: string): DumpFormat {
  if (key.endsWith(".sql.gpg") || key.endsWith(".sql.gz.gpg")) return "plain";
  if (key.endsWith(".dump.gpg")) return "custom";
  throw new Error(`Cannot determine backup format from key: ${key}`);
}
