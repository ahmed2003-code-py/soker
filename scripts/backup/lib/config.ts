/**
 * Environment variable validation and typed config object.
 *
 * UPGRADE PATH (plain → custom format):
 *   Change `format` to 'custom' in loadConfig().
 *   When format='custom':
 *     - pg_dump uses -Fc (binary, already compressed, supports parallel restore)
 *     - No separate gzip step needed
 *     - Set parallelJobs > 1 for large databases
 *   The backup.ts flow branches on config.format — no other changes needed.
 */

export type DumpFormat = "plain" | "custom";

export interface RetentionPolicy {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface BackupConfig {
  // Database
  databaseUrl: string;

  // Dump format — switch to 'custom' for pg_dump -Fc when DB grows
  format: DumpFormat;
  parallelJobs: number; // used only when format='custom'

  // Cloudflare R2
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;

  // GPG symmetric encryption
  gpgPassphrase: string;

  // Optional webhook for success/failure notifications
  alertWebhookUrl: string | undefined;

  // Retention
  retention: RetentionPolicy;

  // Local temp directory for intermediate files
  tempDir: string;
}

const REQUIRED_VARS = [
  "DATABASE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "BACKUP_GPG_PASSPHRASE",
] as const;

export function loadConfig(): BackupConfig {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `See .env.example for the full list.`
    );
  }

  return {
    databaseUrl: process.env.DATABASE_URL!,

    // Change to 'custom' when ready to upgrade (see module docstring above)
    format: (process.env.BACKUP_FORMAT as DumpFormat | undefined) ?? "plain",
    parallelJobs: parseInt(process.env.BACKUP_PARALLEL_JOBS ?? "1", 10),

    r2AccountId: process.env.R2_ACCOUNT_ID!,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID!,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    r2BucketName: process.env.R2_BUCKET_NAME!,

    gpgPassphrase: process.env.BACKUP_GPG_PASSPHRASE!,
    alertWebhookUrl: process.env.BACKUP_ALERT_WEBHOOK_URL || undefined,

    retention: {
      daily: parseInt(process.env.BACKUP_RETENTION_DAILY ?? "7", 10),
      weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY ?? "4", 10),
      monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY ?? "12", 10),
    },

    tempDir: process.env.BACKUP_TEMP_DIR ?? "/tmp",
  };
}
