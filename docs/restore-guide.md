# Restore Guide — Soker ERP

> **Read this before you need it.** Restore procedures practiced under pressure fail.
> Test this guide on a staging database at least once.

---

## What You Need

- PostgreSQL 16 client tools (`psql`, `pg_restore`)
- GnuPG 2.1+ (`gpg`)
- AWS CLI (or use the restore script — recommended)
- The `BACKUP_GPG_PASSPHRASE` value (stored in your password manager)
- A target PostgreSQL database URL (**not production** unless this is a real DR event)

---

## Option A — Automated Restore Script (Recommended)

The restore script downloads, decrypts, decompresses, and restores in one command.

```bash
# Clone the repo if you don't have it locally
git clone https://github.com/ahmed2003-code-py/soker.git
cd soker

# Install dependencies
npm ci

# Set required env vars
export DATABASE_URL="postgresql://..."         # Your backup R2 credentials
export R2_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
export R2_BUCKET_NAME="soker-backups"
export BACKUP_GPG_PASSPHRASE="..."             # From your password manager

# Target database — WHERE to restore INTO (NOT production unless DR)
export RESTORE_TARGET_DB="postgresql://user:pass@host:5432/soker_restored"

# Restore latest daily backup
npx tsx scripts/backup/restore.ts

# Restore a specific backup
export RESTORE_BACKUP_KEY="daily/sokkar-daily-2026-06-18-0200.sql.gpg"
npx tsx scripts/backup/restore.ts
```

---

## Option B — Manual Step-by-Step

Use this if the automated script is unavailable or for auditing purposes.

### Step 1: Find the backup to restore

```bash
# Configure AWS CLI for R2
aws configure set aws_access_key_id "$R2_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "$R2_SECRET_ACCESS_KEY"
export R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# List available daily backups (newest first)
aws s3 ls s3://${R2_BUCKET_NAME}/daily/ \
  --endpoint-url="$R2_ENDPOINT" \
  | sort -r
```

Pick the backup filename you want to restore, e.g.:
`sokkar-daily-2026-06-18-0200.sql.gpg`

### Step 2: Download from R2

```bash
BACKUP_KEY="daily/sokkar-daily-2026-06-18-0200.sql.gpg"
WORK_DIR="/tmp/soker-restore"
mkdir -p "$WORK_DIR"

aws s3 cp "s3://${R2_BUCKET_NAME}/${BACKUP_KEY}" \
  "$WORK_DIR/backup.gpg" \
  --endpoint-url="$R2_ENDPOINT"
```

### Step 3: Decrypt

```bash
# Interactive (GPG will prompt for passphrase)
gpg --batch --decrypt \
  --output "$WORK_DIR/backup.sql.gz" \
  "$WORK_DIR/backup.gpg"

# Non-interactive (passphrase from env var)
echo "$BACKUP_GPG_PASSPHRASE" | \
  gpg --batch --yes \
      --passphrase-fd 0 \
      --pinentry-mode loopback \
      --decrypt \
      --output "$WORK_DIR/backup.sql.gz" \
      "$WORK_DIR/backup.gpg"
```

### Step 4: Verify integrity before restoring

```bash
# Check the gzip file is valid
gunzip --test "$WORK_DIR/backup.sql.gz"
echo "Exit code: $?"   # Must be 0

# Check file size (should be non-zero)
ls -lh "$WORK_DIR/backup.sql.gz"
```

### Step 5: Decompress

```bash
gunzip --keep "$WORK_DIR/backup.sql.gz"
# Creates: $WORK_DIR/backup.sql
ls -lh "$WORK_DIR/backup.sql"
```

### Step 6: Restore into PostgreSQL

```bash
TARGET_DB="postgresql://user:pass@host:5432/soker_target"

# Drop and recreate (if target exists and you want a clean slate)
psql "$TARGET_DB" --command "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore
psql "$TARGET_DB" \
  --file "$WORK_DIR/backup.sql" \
  --echo-errors \
  --set ON_ERROR_STOP=off
```

> `ON_ERROR_STOP=off` is used because the `--clean --if-exists` dump includes
> DROP statements that may produce harmless errors on a fresh database.
> If you see only "does not exist" errors, that's expected.

### Step 7: Verify the restored data

```bash
psql "$TARGET_DB" <<'SQL'
SELECT 'Party'          AS tbl, COUNT(*) AS rows FROM "Party"
UNION ALL
SELECT 'Invoice',              COUNT(*) FROM "Invoice"
UNION ALL
SELECT 'LedgerEntry',          COUNT(*) FROM "LedgerEntry"
UNION ALL
SELECT 'TreasuryAccount',      COUNT(*) FROM "TreasuryAccount"
UNION ALL
SELECT 'TreasuryTxn',          COUNT(*) FROM "TreasuryTxn"
UNION ALL
SELECT 'Cheque',               COUNT(*) FROM "Cheque"
ORDER BY tbl;
SQL
```

### Step 8: Cleanup

```bash
rm -rf "$WORK_DIR"
```

---

## Restoring a Custom Format Backup (*.dump.gpg)

If `BACKUP_FORMAT=custom` was in use, the file ends in `.dump.gpg` instead of `.sql.gpg`.

```bash
# After decrypting to backup.dump:
pg_restore \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --dbname "$TARGET_DB" \
  "$WORK_DIR/backup.dump"

# For faster parallel restore (on large databases):
pg_restore \
  --no-owner --no-acl --clean --if-exists \
  --jobs 4 \
  --dbname "$TARGET_DB" \
  "$WORK_DIR/backup.dump"
```

---

## Pointing Railway at the Restored Database

After verifying the restored data, update the `DATABASE_URL` environment variable
in your Railway service to point at the new database, then redeploy.

Railway dashboard → Your service → Variables → `DATABASE_URL` → Edit → Redeploy.

---

## Retention Reference

| Prefix | Keeps | Schedule |
|---|---|---|
| `daily/` | Last 7 | Every day at 02:00 UTC |
| `weekly/` | Last 4 | Sunday (same run, copied to weekly/) |
| `monthly/` | Last 12 | 1st of month (same run, copied to monthly/) |
