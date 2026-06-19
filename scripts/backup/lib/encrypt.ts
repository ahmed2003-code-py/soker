/**
 * GPG symmetric encryption / decryption.
 *
 * Passphrase is passed via --passphrase-fd 0 (stdin), so it NEVER
 * appears in the process argument list (not visible in `ps aux`).
 *
 * To decrypt manually:
 *   gpg --batch --decrypt --output output.sql.gz input.sql.gz.gpg
 *   (GPG will prompt for the passphrase interactively)
 *
 * Or non-interactively (for scripts):
 *   echo "$BACKUP_GPG_PASSPHRASE" | \
 *     gpg --batch --yes --passphrase-fd 0 --pinentry-mode loopback \
 *         --decrypt --output output.sql.gz input.sql.gz.gpg
 */

import { spawn } from "child_process";
import { logger } from "./logger.js";

/** Build the common GPG args that prevent any passphrase leakage. */
function gpgBaseArgs(): string[] {
  return [
    "--batch",
    "--yes",
    "--pinentry-mode",
    "loopback", // Required in GPG 2.1+ to allow --passphrase-fd
    "--passphrase-fd",
    "0", // Read passphrase from stdin (fd 0)
  ];
}

function runGpg(args: string[], passphrase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("gpg", args, { stdio: ["pipe", "inherit", "pipe"] });

    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Log stderr but NEVER include the passphrase in the error message.
        // Mask any potential credential leakage from gpg output.
        const safeStderr = stderr.replace(/passphrase.*/gi, "passphrase: ***");
        reject(new Error(`gpg exited with code ${code}: ${safeStderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn gpg: ${err.message}. Is GPG installed?`));
    });

    // Write passphrase to stdin and close immediately
    proc.stdin!.write(passphrase + "\n");
    proc.stdin!.end();
  });
}

/**
 * Encrypt inputPath → outputPath using AES-256 symmetric encryption.
 * The input file is NOT deleted by this function — caller decides lifecycle.
 */
export async function encryptFile(
  inputPath: string,
  outputPath: string,
  passphrase: string
): Promise<void> {
  logger.info("encrypt.start", { inputPath, outputPath });

  const args = [
    ...gpgBaseArgs(),
    "--symmetric",
    "--cipher-algo",
    "AES256",
    "--compress-algo",
    "none", // Input is already gzip-compressed; double compression wastes CPU
    "--output",
    outputPath,
    inputPath,
  ];

  await runGpg(args, passphrase);
  logger.info("encrypt.done", { outputPath });
}

/**
 * Decrypt inputPath → outputPath.
 * Used by restore.ts and test-restore.ts.
 */
export async function decryptFile(
  inputPath: string,
  outputPath: string,
  passphrase: string
): Promise<void> {
  logger.info("decrypt.start", { inputPath, outputPath });

  const args = [
    ...gpgBaseArgs(),
    "--decrypt",
    "--output",
    outputPath,
    inputPath,
  ];

  await runGpg(args, passphrase);
  logger.info("decrypt.done", { outputPath });
}
