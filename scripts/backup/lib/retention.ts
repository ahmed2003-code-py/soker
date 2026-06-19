/**
 * Retention policy enforcement.
 * Lists objects in each R2 prefix, keeps the newest N, deletes the rest.
 * Deletion errors are logged as warnings — they never abort the backup.
 */

import type { S3Client } from "@aws-sdk/client-s3";
import { listObjects, deleteObject } from "./r2.js";
import type { RetentionPolicy } from "./config.js";
import { logger } from "./logger.js";

export const PREFIXES = {
  daily: "daily/",
  weekly: "weekly/",
  monthly: "monthly/",
} as const;

export type BackupCategory = keyof typeof PREFIXES;

export async function applyRetention(
  client: S3Client,
  bucket: string,
  policy: RetentionPolicy
): Promise<void> {
  const categories: Array<{ category: BackupCategory; keep: number }> = [
    { category: "daily", keep: policy.daily },
    { category: "weekly", keep: policy.weekly },
    { category: "monthly", keep: policy.monthly },
  ];

  for (const { category, keep } of categories) {
    const prefix = PREFIXES[category];
    const objects = await listObjects(client, bucket, prefix);

    // Sort newest → oldest (by LastModified from R2, not filename)
    objects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    const toDelete = objects.slice(keep);

    logger.info("retention.check", {
      category,
      total: objects.length,
      keep,
      deleting: toDelete.length,
    });

    for (const obj of toDelete) {
      try {
        await deleteObject(client, bucket, obj.key);
        logger.info("retention.pruned", {
          key: obj.key,
          age: obj.lastModified.toISOString(),
        });
      } catch (err) {
        logger.warn("retention.delete_failed", {
          key: obj.key,
          error: String(err),
        });
      }
    }
  }
}

/**
 * Determine which R2 prefixes a backup made at `date` should go into.
 * Every backup is daily. Sundays are also weekly. 1st of month is also monthly.
 * This means one backup run, uploaded to all applicable prefixes — no duplicate pg_dump.
 */
export function determineCategories(date: Date): BackupCategory[] {
  const cats: BackupCategory[] = ["daily"];
  if (date.getUTCDay() === 0) cats.push("weekly"); // Sunday UTC
  if (date.getUTCDate() === 1) cats.push("monthly"); // 1st of month UTC
  return cats;
}
