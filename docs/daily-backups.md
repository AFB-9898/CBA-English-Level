# Daily Database Backups

The host creates one PostgreSQL custom-format logical backup of the application-owned `public` schema each day. A single `pg_dump` command provides one consistent MVCC snapshot. Supabase-managed schemas and built-in roles are intentionally outside this recovery boundary: a fresh local Supabase stack supplies them during the local restore drill.

Every backup contains `database.dump`, an authenticated `manifest`, and `manifest.hmac`. The HMAC key is not stored in Git or in the backup directory.

## Schedule and retention

The versioned systemd timer runs daily at 02:15 local server time, with a randomized delay of up to 15 minutes and catch-up after downtime. The `Type=oneshot` service has a 20-minute execution limit. The script retries export or publication at most twice after its initial failure, with a five-minute delay. After publication, retention pruning runs once: a pruning failure leaves the valid backup in place, reports a distinct nonzero result, and never creates another dump.

| Retention tier | Kept for |
|---|---:|
| Daily backups | 14 days |
| Sunday weekly backups | 8 weeks |
| First-of-month backups | 12 months |

Backups are private (`0700` directory, `0600` files) in `/var/lib/cba-supabase-backups` by default. Each in-progress `.staging.*` directory records its process identity. Startup removes failed remnants whose owner is no longer running; unowned remnants require one hour of age before removal, and staging owned by an active process is preserved. Process exit removes only its own staging directory. Move or replicate that directory to separately protected storage; local retention alone does not protect against host loss.

Backup IDs use their UTC timestamp. If a directory for that second already exists, the script appends an incrementing suffix while holding its exclusive lock, so it never overwrites an existing backup.

## Install the scheduler

1. Deploy this repository at `/opt/cba-english-level`, or update the service paths consistently. Install the PostgreSQL client package that supplies `pg_dump` and ensure it is available to `cba-backup`.
2. Create the service account, state directory, and secret directory:

```bash
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin cba-backup
sudo install -d -o cba-backup -g cba-backup -m 0700 /var/lib/cba-supabase-backups
sudo install -d -o cba-backup -g cba-backup -m 0700 /etc/cba-supabase-backup
```

3. Create `/etc/cba-supabase-backup/pgpass` using PostgreSQL's `host:port:database:user:password` format and generate an independent HMAC key. Keep both files outside Git and mode `0600`:

```bash
sudo install -o cba-backup -g cba-backup -m 0600 /dev/null /etc/cba-supabase-backup/pgpass
sudo openssl rand -out /etc/cba-supabase-backup/manifest-hmac.key 32
sudo chown cba-backup:cba-backup /etc/cba-supabase-backup/manifest-hmac.key
sudo chmod 0600 /etc/cba-supabase-backup/manifest-hmac.key
```

4. Create `/etc/cba-supabase-backup.env` with mode `0600`, owned by `root:cba-backup`. It contains connection parameters only, never a URL or password:

```bash
PGHOST=db.example.supabase.co
PGPORT=5432
PGDATABASE=postgres
PGUSER=backup_role
PGPASSFILE=/etc/cba-supabase-backup/pgpass
BACKUP_HMAC_KEY_FILE=/etc/cba-supabase-backup/manifest-hmac.key
```

The scripts reject `PGPASSWORD`, missing or empty secret files, and secret files with broader permissions. Credentials are read by `pg_dump` from `PGPASSFILE`; they are never placed in command arguments, manifests, stdout, or systemd unit definitions.

5. Install and enable the timer:

```bash
sudo install -m 0644 deploy/systemd/cba-supabase-backup.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/cba-supabase-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cba-supabase-backup.timer
systemctl list-timers cba-supabase-backup.timer
```

Run an on-demand backup and inspect only its success/failure status; do not print the environment file:

```bash
sudo systemctl start cba-supabase-backup.service
sudo journalctl -u cba-supabase-backup.service --since today
```

## Restore locally only

The restore script accepts no connection options and anchors itself to the repository checkout containing the script, never the caller's current directory. It authenticates the manifest with `BACKUP_HMAC_KEY_FILE` before it starts that checkout's local Supabase Docker stack, preserves local managed-schema triggers that call `public` functions as replayable SQL, then destroys and restores that stack's `public` schema and reapplies those triggers. If a failure occurs after replacing `public`, it retries the authenticated restore and trigger replay; its final status explicitly states whether recovery succeeded or the local schema may be incomplete.

```bash
BACKUP_HMAC_KEY_FILE=/etc/cba-supabase-backup/manifest-hmac.key \
  ./scripts/restore-backup-local.sh --replace-local /var/lib/cba-supabase-backups/2026-07-28T021500Z
```

Custom dumps use `--no-owner --no-privileges` and exclude role exports. This deliberately avoids collisions with Supabase built-in roles such as `postgres`, `anon`, `authenticated`, and `supabase_*`; application privileges must be reconstructed by the restored application schema or local stack defaults. This is not a remote or production recovery procedure.

## Local verification

Run the complete disposable local-only drill:

```bash
./scripts/verify-backup-local.sh
```

Run the focused retry, retention, and staging-cleanup tests without PostgreSQL or Docker:

```bash
./scripts/test-backup-daily.sh
```

It starts the checkout's Docker stack, inserts disposable markers and a managed-schema trigger that calls a `public` function, creates a backup through a local container adapter, verifies empty-key and wrong-checkout rejection, verifies the HMAC before destructive restore, and then compares the full data fingerprint, marker table definition and values, trigger replay, and automatic post-recreate recovery. It never accepts, reads, dumps, modifies, or contacts a remote database.

## Integrity and rollback

The HMAC authenticates the manifest and its dump SHA-256 checksum before every restore. Protect and rotate the HMAC key separately from backups: losing it makes existing backups intentionally unverifiable. HMAC does not provide encrypted-at-rest backups; use separately managed encrypted storage when that is required.

To roll back the scheduler, first disable and stop the installed timer, then stop the service in case it was started manually:

```bash
sudo systemctl disable --now cba-supabase-backup.timer
sudo systemctl stop cba-supabase-backup.service
sudo rm /etc/systemd/system/cba-supabase-backup.service /etc/systemd/system/cba-supabase-backup.timer
sudo systemctl daemon-reload
```

The service is a static `Type=oneshot` unit and therefore has no `[Install]` section to disable separately. Existing backups remain untouched. After disabling the installed units, removing `scripts/backup-daily.sh`, `scripts/restore-backup-local.sh`, `scripts/verify-backup-local.sh`, `deploy/systemd/cba-supabase-backup.*`, and this guide rolls back this capability without changing application or database behavior.
