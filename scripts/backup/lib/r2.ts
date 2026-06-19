/**
 * Cloudflare R2 client (S3-compatible API).
 * Handles upload, size verification, listing, and deletion.
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream } from "fs";
import { stat } from "fs/promises";
import { pipeline } from "stream/promises";
import type { Readable } from "stream";
import { logger } from "./logger.js";

export interface R2Object {
  key: string;
  lastModified: Date;
  size: number;
}

export function createR2Client(config: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/** Upload a local file to R2. Returns the final object size from HeadObject. */
export async function uploadFile(
  client: S3Client,
  bucket: string,
  key: string,
  localPath: string
): Promise<number> {
  const fileStat = await stat(localPath);
  const fileSize = fileStat.size;

  logger.info("r2.upload_start", { key, localPath, bytes: fileSize });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(localPath),
      ContentLength: fileSize,
      ContentType: "application/octet-stream",
      Metadata: {
        "backup-created": new Date().toISOString(),
        "source-app": "soker-erp",
      },
    })
  );

  logger.info("r2.upload_done", { key, bytes: fileSize });
  return fileSize;
}

/** Verify the uploaded object exists and matches expected size. */
export async function verifyObject(
  client: S3Client,
  bucket: string,
  key: string,
  expectedBytes: number
): Promise<void> {
  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  );
  const remoteSize = head.ContentLength ?? 0;

  if (remoteSize !== expectedBytes) {
    throw new Error(
      `R2 object size mismatch for "${key}": ` +
        `expected ${expectedBytes} bytes, got ${remoteSize} bytes`
    );
  }
  logger.info("r2.verify_ok", { key, bytes: remoteSize });
}

/** List all objects under a prefix, paginating automatically. */
export async function listObjects(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<R2Object[]> {
  const results: R2Object[] = [];
  let continuationToken: string | undefined;

  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of resp.Contents ?? []) {
      if (obj.Key && obj.LastModified && obj.Size != null) {
        results.push({
          key: obj.Key,
          lastModified: obj.LastModified,
          size: obj.Size,
        });
      }
    }

    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  return results;
}

/** Delete a single object from R2. */
export async function deleteObject(
  client: S3Client,
  bucket: string,
  key: string
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  logger.info("r2.deleted", { key });
}

/** Download an object to a local file. */
export async function downloadObject(
  client: S3Client,
  bucket: string,
  key: string,
  localPath: string
): Promise<void> {
  const resp = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  if (!resp.Body) throw new Error(`Empty response body for key "${key}"`);

  const writer = createWriteStream(localPath);
  await pipeline(resp.Body as Readable, writer);
  logger.info("r2.downloaded", { key, localPath });
}
