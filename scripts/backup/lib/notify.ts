/**
 * Webhook notifications (Discord, Slack, or any HTTP POST endpoint).
 * If BACKUP_ALERT_WEBHOOK_URL is not set, this is a no-op.
 * Failures to notify are logged as warnings but never crash the backup.
 */

import { logger } from "./logger.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

/** Payload shape works for both Discord webhooks and generic HTTP endpoints. */
function buildPayload(params: {
  success: boolean;
  backupKey?: string;
  sizeBytes?: number;
  durationMs?: number;
  errorReason?: string;
}) {
  const { success, backupKey, sizeBytes, durationMs, errorReason } = params;

  const title = success ? "✅ Backup succeeded" : "🚨 Backup FAILED";
  const color = success ? 0x22c55e : 0xef4444; // green / red

  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  if (backupKey) fields.push({ name: "File", value: backupKey, inline: false });
  if (sizeBytes != null)
    fields.push({ name: "Size", value: formatBytes(sizeBytes), inline: true });
  if (durationMs != null)
    fields.push({
      name: "Duration",
      value: `${(durationMs / 1000).toFixed(1)}s`,
      inline: true,
    });
  if (errorReason)
    fields.push({ name: "Error", value: errorReason.slice(0, 1000), inline: false });

  return {
    // Discord embed format (also accepted by many Slack-compatible webooks)
    embeds: [
      {
        title,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "Soker ERP · automated backup" },
      },
    ],
  };
}

export async function notify(
  webhookUrl: string | undefined,
  params: {
    success: boolean;
    backupKey?: string;
    sizeBytes?: number;
    durationMs?: number;
    errorReason?: string;
  }
): Promise<void> {
  if (!webhookUrl) return; // Optional — silently skip

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(params)),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    if (!res.ok) {
      logger.warn("notify.http_error", { status: res.status });
    } else {
      logger.info("notify.sent", { success: params.success });
    }
  } catch (err) {
    // Never let notification failure crash the backup
    logger.warn("notify.failed", { error: String(err) });
  }
}
