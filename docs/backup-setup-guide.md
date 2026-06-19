# Backup Setup Guide — Soker ERP

## Overview

Automated daily PostgreSQL backups to Cloudflare R2:

```
pg_dump (plain SQL)
  → gzip (level 6)
    → GPG AES-256 symmetric encryption
      → Cloudflare R2 (S3-compatible)
```

Scheduling runs on **GitHub Actions** (free, reliable, outside Railway).

---

## 1. Prerequisites

### Tools (installed automatically by GitHub Actions)
- `pg_dump` / `psql` — PostgreSQL 16 client tools
- `gpg` — GnuPG 2.1+

### For local testing only
```bash
# Ubuntu / Debian
sudo apt-get install postgresql-client-16 gpg

# macOS
brew install postgresql gpg
```

---

## 2. Environment Variables

Add ALL of these to your GitHub repository secrets (`Settings → Secrets and variables → Actions`).

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Railway public URL, includes port) |
| `R2_ACCOUNT_ID` | Cloudflare account ID (from R2 dashboard) |
| `R2_ACCESS_KEY_ID` | R2 API token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token Secret Access Key |
| `R2_BUCKET_NAME` | Name of the R2 bucket created for backups |
| `BACKUP_GPG_PASSPHRASE` | Strong random passphrase for AES-256 encryption. **Store this in 1Password / KeePass — losing it means losing access to all backups.** |

### Optional

| Variable | Default | Description |
|---|---|---|
| `BACKUP_ALERT_WEBHOOK_URL` | (none) | Discord or Slack webhook URL for success/failure alerts |
| `BACKUP_RETENTION_DAILY` | `7` | Daily backups to keep |
| `BACKUP_RETENTION_WEEKLY` | `4` | Weekly backups to keep (uploaded on Sundays) |
| `BACKUP_RETENTION_MONTHLY` | `12` | Monthly backups to keep (uploaded on 1st of month) |
| `BACKUP_TEMP_DIR` | `/tmp` | Local temp directory for intermediate files |
| `BACKUP_FORMAT` | `plain` | `plain` = SQL+gzip, `custom` = pg_dump -Fc (see upgrade notes) |

---

## 3. Cloudflare R2 Setup

1. Go to **Cloudflare Dashboard → R2 → Create Bucket**
2. Name: `soker-backups` (or anything — set in `R2_BUCKET_NAME`)
3. Location: auto (or closest region to you)
4. Create an **R2 API Token**:
   - R2 → Manage R2 API Tokens → Create API Token
   - Permissions: **Object Read & Write**
   - Specify bucket: `soker-backups`
   - Copy the `Access Key ID` and `Secret Access Key`
5. Note your **Account ID** from the R2 overview page

### Bucket structure created automatically

```
soker-backups/
├── daily/
│   ├── backup-2026-06-18-02-00.sql.gz.gpg
│   └── backup-2026-06-19-02-00.sql.gz.gpg
├── weekly/
│   └── backup-2026-06-15-02-00.sql.gz.gpg   ← Sundays
└── monthly/
    └── backup-2026-06-01-02-00.sql.gz.gpg   ← 1st of month
```

---

## 4. GitHub Repository Secrets

```
GitHub → Your Repo → Settings → Secrets and variables → Actions → New repository secret
```

Add each variable from Section 2.

---

## 5. Schedule

The workflow runs daily at **02:00 UTC** (04:00 Cairo EET / 05:00 EEST in summer).

File: `.github/workflows/db-backup.yml`

To change the schedule, edit the `cron` expression:
```yaml
schedule:
  - cron: "0 2 * * *"   # 02:00 UTC daily
```

---

## 6. Manual Test Run

### Trigger from GitHub UI
1. Go to **Actions → PostgreSQL Backup → Run workflow**
2. Click **Run workflow** (uses main branch)
3. Watch the logs in real time

### Run locally
```bash
# Copy env vars
cp .env.example .env.backup
# Fill in all values, then:
source .env.backup
npx tsx scripts/backup/backup.ts
```

### Run restore test (checks latest backup is restorable)
```bash
source .env.backup
npx tsx scripts/backup/test-restore.ts
```

---

## 7. Upgrading to Custom Format (for large databases)

When your database grows significantly (> 1 GB), switch to pg_dump custom format:

1. Set `BACKUP_FORMAT=custom` in GitHub secrets
2. Optionally set `BACKUP_PARALLEL_JOBS=4` (for faster restore with `pg_restore -j`)
3. No other code changes needed — `backup.ts` branches on `config.format`

Custom format differences:
- pg_dump produces binary output (already compressed) — no separate gzip step
- Files will be named `*.dump.gpg` instead of `*.sql.gz.gpg`
- Restore uses `pg_restore` instead of `psql`
- Restore can be parallelized: `pg_restore -j 4 ...`

---

## 8. Monitoring

### Check backup status
```bash
# List all backups in R2 (using AWS CLI configured for R2)
aws s3 ls s3://soker-backups/daily/ --endpoint-url=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com

# Check GitHub Actions run history
# GitHub → Actions → PostgreSQL Backup
```

### Webhook notifications

Set `BACKUP_ALERT_WEBHOOK_URL` to a Discord or Slack webhook URL.

Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy URL

Each backup sends:
- ✅ Success: file name, size, duration
- 🚨 Failure: error reason

---

## 9. Railway Native Cron (Alternative)

Railway supports cron jobs as a separate service. Pros: runs in the same private network as your database (no need for a public DATABASE_URL). Cons: more complex setup, requires configuring a container with pg_dump + gpg.

**Setup:**
1. Railway dashboard → New Service → Empty Service
2. Set start command: `npx tsx scripts/backup/backup.ts`
3. Add all required env vars in Railway service settings
4. Railway → Service Settings → Schedule → add cron expression
5. The Nixpacks builder won't include pg_dump by default — add a `Dockerfile` or `nixpacks.toml` for the backup service

**Why we chose GitHub Actions instead:**
- 2000 free minutes/month (ample for daily 5-min backups)
- Better logging and failure visibility
- No additional Railway service to manage
- `workflow_dispatch` for easy manual triggers
- Railway cron is still newer; GitHub Actions is battle-tested
