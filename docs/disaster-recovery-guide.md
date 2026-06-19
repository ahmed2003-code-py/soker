# Disaster Recovery Guide — Soker ERP

## Scope

This document covers the scenario where the Railway PostgreSQL database is **completely lost**
(corrupted, accidentally deleted, or Railway infrastructure failure). It provides step-by-step
recovery procedures, RTO/RPO targets, and escalation steps.

---

## RPO / RTO Targets

| Metric | Target | Notes |
|---|---|---|
| **RPO** (Recovery Point Objective) | ≤ 24 hours | Daily backups at 02:00 UTC. Worst case: data from the last 24 hours is lost. |
| **RTO** (Recovery Time Objective) | ≤ 2 hours | Time to restore backup + update Railway config + verify + notify users. |

> To improve RPO to ≤ 1 hour: set `cron: "0 * * * *"` in the GitHub Actions workflow
> (hourly backups). Storage cost on R2 is ~$0.015/GB/month — negligible for a 19 MB database.

---

## Prerequisites (prepare before an incident)

- [ ] `BACKUP_GPG_PASSPHRASE` saved in a password manager (1Password / KeePass)
  accessible to BOTH owners independently
- [ ] GitHub repository secrets all set (R2 + DB + GPG)
- [ ] The restore guide (`docs/restore-guide.md`) has been tested at least once
- [ ] A second contact (Ahmed / Mahmoud) knows where the passphrase is stored

---

## Incident Response — Step by Step

### Phase 1: Confirm the incident (5 min)

1. Try to connect to the database:
   ```bash
   psql "$DATABASE_URL" --command "SELECT 1;"
   ```
2. Check Railway dashboard → PostgreSQL service → Status
3. Check Railway status page: https://railway.instatus.com
4. If Railway is having an outage: wait and monitor — do not attempt restore yet
5. If the DB is genuinely lost: proceed to Phase 2

### Phase 2: Provision a new database (15 min)

**Option A — Railway PostgreSQL (recommended, same network)**
1. Railway dashboard → New Service → Add a plugin → PostgreSQL
2. Once provisioned, copy the `DATABASE_URL` from the new service's Variables tab
3. Save it as `NEW_DATABASE_URL` — you'll need it in Phase 3

**Option B — External provider (Neon, Supabase, etc.)**
1. Create a new PostgreSQL database on the chosen provider
2. Copy the connection string

### Phase 3: Restore the backup (30 min)

Follow the restore procedure in `docs/restore-guide.md`, Option A (automated script).

```bash
export DATABASE_URL="$R2_CREDENTIALS_..."   # unchanged — for R2 access
export RESTORE_TARGET_DB="$NEW_DATABASE_URL"

# Run restore (restores latest daily backup by default)
npx tsx scripts/backup/restore.ts
```

To restore a specific backup (e.g., yesterday's):
```bash
export RESTORE_BACKUP_KEY="daily/backup-2026-06-17-02-00.sql.gz.gpg"
npx tsx scripts/backup/restore.ts
```

### Phase 4: Verify the restored data (15 min)

```bash
psql "$NEW_DATABASE_URL" <<'SQL'
SELECT 'Party'         AS tbl, COUNT(*) AS rows FROM "Party"
UNION ALL
SELECT 'Invoice',             COUNT(*) FROM "Invoice"
UNION ALL
SELECT 'LedgerEntry',         COUNT(*) FROM "LedgerEntry"
UNION ALL
SELECT 'TreasuryAccount',     COUNT(*) FROM "TreasuryAccount"
ORDER BY tbl;
SQL
```

Compare row counts against your last known good counts. Even rough estimates are useful:
"we had ~50 customers and ~500 invoices". If numbers are dramatically off, try an older backup.

### Phase 5: Switch the application to the new database (10 min)

1. Railway dashboard → Your App service → Variables
2. Update `DATABASE_URL` to `$NEW_DATABASE_URL`
3. Click **Deploy** (or Railway will auto-deploy on variable change)
4. Railway runs `prisma migrate deploy` on startup — this is safe on a restored DB
5. Verify the app is serving requests: https://soker-production.up.railway.app/login

### Phase 6: Update backup credentials (5 min)

The backup script uses `DATABASE_URL` to connect. Update GitHub secrets:

1. GitHub → repo → Settings → Secrets → `DATABASE_URL` → update to new DB URL
2. Trigger a manual backup to confirm the new DB is being backed up:
   GitHub → Actions → PostgreSQL Backup → Run workflow

### Phase 7: Notify and document (ongoing)

1. Inform Ahmed and Mahmoud of:
   - Exact time of incident
   - Which backup was restored (date/time of backup)
   - How much data was lost (gap between last backup and incident)
2. Document the incident in a brief post-mortem (even a few bullet points)
3. Consider running `scripts/backup/test-restore.ts` weekly to validate backups proactively

---

## What Data May Be Lost

The backup captures a point-in-time snapshot at the backup timestamp.
Data entered AFTER the last backup and BEFORE the incident is lost.

With daily backups at 02:00 UTC and an incident at 23:00 UTC:
→ Up to 21 hours of data is lost.

**Manual recovery of lost transactions:**
If the owners have paper records, WhatsApp messages, or memory of what was entered
after the last backup, those entries can be re-entered manually after restore.
The activity log and invoice numbers will have a gap — this is expected and acceptable.

---

## Escalation

| Scenario | Action |
|---|---|
| Railway outage (not data loss) | Wait. Monitor https://railway.instatus.com. Data is safe. |
| Railway data loss confirmed | Follow phases 1–7 above |
| R2 backup unavailable | Check Cloudflare status. Try downloading from R2 dashboard directly. |
| GPG passphrase lost | CRITICAL — you cannot decrypt backups. Check password manager. Contact both owners. |
| GitHub Actions workflow failing | Check Actions logs. Run restore script locally with env vars set manually. |

---

## Testing Schedule

| Test | Frequency | Owner |
|---|---|---|
| Verify backup runs (check GitHub Actions) | Weekly | Ahmed or Mahmoud |
| Run `test-restore.ts` to validate latest backup | Monthly | Ahmed or Mahmoud |
| Full DR simulation (restore to staging, verify app works) | Quarterly | Ahmed |

---

## Key Files Reference

| File | Purpose |
|---|---|
| `scripts/backup/backup.ts` | Main backup script |
| `scripts/backup/restore.ts` | Manual restore helper |
| `scripts/backup/test-restore.ts` | Automated restore integrity test |
| `docs/restore-guide.md` | Step-by-step restore commands |
| `.github/workflows/db-backup.yml` | GitHub Actions schedule |
| `.env.example` | All required environment variables |
