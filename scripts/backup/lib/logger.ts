/**
 * Structured JSON logger for backup scripts.
 * All output goes to stdout (Railway captures it).
 * Secrets are masked before any log entry is written.
 */

type Level = "info" | "warn" | "error" | "debug";

/** Fields whose values are always replaced with *** */
const SENSITIVE_KEYS = new Set([
  "password",
  "passphrase",
  "secret",
  "token",
  "secretaccesskey",
  "accesskeyid",
  "database_url",
  "connection",
  "dsn",
  "gpgpassphrase",
  "r2secretaccesskey",
]);

function maskString(s: string): string {
  return (
    s
      // PostgreSQL / generic DB connection strings
      .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://***:***@")
      .replace(/postgres:\/\/[^@\s]+@/gi, "postgres://***:***@")
      // key=value style in error messages
      .replace(/(password\s*[=:]\s*)\S+/gi, "$1***")
      .replace(/(passphrase\s*[=:]\s*)\S+/gi, "$1***")
      .replace(/(secret\s*[=:]\s*)\S+/gi, "$1***")
  );
}

function maskValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase().replace(/[^a-z]/g, ""))) {
    return "***";
  }
  if (typeof value === "string") return maskString(value);
  if (Array.isArray(value)) return value.map((v) => maskValue("", v));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        maskValue(k, v),
      ])
    );
  }
  return value;
}

function maskData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, maskValue(k, v)])
  );
}

function emit(
  level: Level,
  event: string,
  data?: Record<string, unknown>
): void {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(data ? maskData(data) : {}),
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) =>
    emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) =>
    emit("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) =>
    emit("error", event, data),
  debug: (event: string, data?: Record<string, unknown>) =>
    emit("debug", event, data),
};
