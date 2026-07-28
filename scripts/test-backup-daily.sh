#!/usr/bin/env bash
# Tests retry and post-publication cleanup behavior without contacting Postgres.
set -Eeuo pipefail
umask 077

repo_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tmp_root="$(mktemp -d)"
trap 'rm -rf -- "$tmp_root"' EXIT

fail() {
  printf 'backup test failed: %s\n' "$1" >&2
  exit 1
}

make_adapter() {
  local adapter_dir="$1"
  mkdir -p -- "$adapter_dir"

  cat > "$adapter_dir/pg_dump" <<'EOF'
#!/usr/bin/env bash
count_file="$BACKUP_TEST_STATE/pg_dump.count"
count="$(cat "$count_file" 2>/dev/null || printf '0')"
count=$((count + 1))
printf '%s\n' "$count" > "$count_file"
if (( count <= BACKUP_TEST_FAIL_PG_DUMP_ATTEMPTS )); then
  exit 1
fi
printf 'test dump %s\n' "$count"
EOF

  cat > "$adapter_dir/mv" <<'EOF'
#!/usr/bin/env bash
count_file="$BACKUP_TEST_STATE/mv.count"
count="$(cat "$count_file" 2>/dev/null || printf '0')"
count=$((count + 1))
printf '%s\n' "$count" > "$count_file"
if (( count <= BACKUP_TEST_FAIL_MV_ATTEMPTS )); then
  exit 1
fi
exec /bin/mv "$@"
EOF

  cat > "$adapter_dir/rm" <<'EOF'
#!/usr/bin/env bash
for argument in "$@"; do
  if [[ "$argument" == */2000-01-01T000000Z ]] && (( BACKUP_TEST_FAIL_PRUNE )); then
    exit 1
  fi
done
exec /bin/rm "$@"
EOF

  cat > "$adapter_dir/sleep" <<'EOF'
#!/usr/bin/env bash
printf 'sleep\n' >> "$BACKUP_TEST_STATE/sleep.count"
EOF
  chmod 700 "$adapter_dir/pg_dump" "$adapter_dir/mv" "$adapter_dir/rm" "$adapter_dir/sleep"
}

run_case() {
  local name="$1" expected_pg_dumps="$2" expected_mvs="$3" expected_status="$4"
  local case_root="$tmp_root/$name" state_dir="$case_root/state" backup_root="$case_root/backups"
  local output status
  mkdir -p -- "$state_dir" "$backup_root"
  printf 'test hmac key\n' > "$case_root/hmac.key"
  printf 'test pgpass\n' > "$case_root/pgpass"
  chmod 600 "$case_root/hmac.key" "$case_root/pgpass"
  if (( BACKUP_TEST_FAIL_PRUNE )); then
    mkdir -p -- "$backup_root/2000-01-01T000000Z"
  fi

  set +e
  output="$(PATH="$case_root/bin:$PATH" BACKUP_TEST_STATE="$state_dir" BACKUP_ROOT="$backup_root" \
    BACKUP_HMAC_KEY_FILE="$case_root/hmac.key" PG_DUMP_BIN=pg_dump \
    PGHOST=local PGPORT=5432 PGDATABASE=postgres PGUSER=postgres PGPASSFILE="$case_root/pgpass" \
    BACKUP_TEST_FAIL_PG_DUMP_ATTEMPTS="$BACKUP_TEST_FAIL_PG_DUMP_ATTEMPTS" \
    BACKUP_TEST_FAIL_MV_ATTEMPTS="$BACKUP_TEST_FAIL_MV_ATTEMPTS" \
    BACKUP_TEST_FAIL_PRUNE="$BACKUP_TEST_FAIL_PRUNE" \
    "$repo_root/scripts/backup-daily.sh" 2>&1)"
  status=$?
  set -e

  [[ "$status" == "$expected_status" ]] || fail "$name returned $status, expected $expected_status: $output"
  [[ "$(cat "$state_dir/pg_dump.count")" == "$expected_pg_dumps" ]] || fail "$name ran pg_dump an unexpected number of times"
  [[ "$(cat "$state_dir/mv.count")" == "$expected_mvs" ]] || fail "$name ran mv an unexpected number of times"
  published_count="$(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '????-??-??T??????Z*' | wc -l)"
  if (( BACKUP_TEST_FAIL_PRUNE )); then
    [[ "$published_count" == '2' ]] || fail "$name did not retain exactly one published backup and the old backup"
    [[ "$output" == *'pruning failed'* ]] || fail "$name did not report the pruning failure"
  else
    [[ "$published_count" == '1' ]] || fail "$name did not publish exactly one backup"
  fi
  [[ -z "$(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '.staging.*' -print -quit)" ]] || \
    fail "$name left a failed-attempt staging directory"
}

test_staging_cleanup_preserves_active_and_published_artifacts() {
  local case_root="$tmp_root/staging-cleanup" state_dir="$case_root/state" backup_root="$case_root/backups"
  local active_staging failed_staging published_backup output
  mkdir -p -- "$state_dir" "$backup_root"
  make_adapter "$case_root/bin"
  printf 'test hmac key\n' > "$case_root/hmac.key"
  printf 'test pgpass\n' > "$case_root/pgpass"
  chmod 600 "$case_root/hmac.key" "$case_root/pgpass"
  published_backup="$backup_root/$(date -u +%Y-%m-%dT%H%M%SZ)"
  failed_staging="$backup_root/.staging.failed"
  active_staging="$backup_root/.staging.active"
  mkdir -p -- "$published_backup" "$failed_staging" "$active_staging"
  printf '%s\n%s\n' '999999' '1' > "$failed_staging/.owner"
  printf '%s\n%s\n' "$$" "$(awk '{ print $22 }' /proc/$$/stat)" > "$active_staging/.owner"
  touch -d '2 hours ago' "$failed_staging" "$active_staging"

  output="$(PATH="$case_root/bin:$PATH" BACKUP_TEST_STATE="$state_dir" BACKUP_ROOT="$backup_root" \
    BACKUP_HMAC_KEY_FILE="$case_root/hmac.key" PG_DUMP_BIN=pg_dump \
    PGHOST=local PGPORT=5432 PGDATABASE=postgres PGUSER=postgres PGPASSFILE="$case_root/pgpass" \
    BACKUP_TEST_FAIL_PG_DUMP_ATTEMPTS=0 BACKUP_TEST_FAIL_MV_ATTEMPTS=0 BACKUP_TEST_FAIL_PRUNE=0 \
    "$repo_root/scripts/backup-daily.sh" 2>&1)" || fail "staging cleanup case failed: $output"

  [[ -d "$published_backup" ]] || fail 'staging cleanup removed a published backup'
  [[ -d "$active_staging" ]] || fail 'staging cleanup removed an active execution staging directory'
  [[ ! -e "$failed_staging" ]] || fail 'staging cleanup retained a failed-attempt remnant'
}

case_root="$tmp_root/pg-dump-retry"
make_adapter "$case_root/bin"
BACKUP_TEST_FAIL_PG_DUMP_ATTEMPTS=1 BACKUP_TEST_FAIL_MV_ATTEMPTS=0 BACKUP_TEST_FAIL_PRUNE=0 \
  run_case 'pg-dump-retry' 2 1 0

case_root="$tmp_root/mv-retry"
make_adapter "$case_root/bin"
BACKUP_TEST_FAIL_PG_DUMP_ATTEMPTS=0 BACKUP_TEST_FAIL_MV_ATTEMPTS=1 BACKUP_TEST_FAIL_PRUNE=0 \
  run_case 'mv-retry' 2 2 0

case_root="$tmp_root/prune-failure"
make_adapter "$case_root/bin"
BACKUP_TEST_FAIL_PG_DUMP_ATTEMPTS=0 BACKUP_TEST_FAIL_MV_ATTEMPTS=0 BACKUP_TEST_FAIL_PRUNE=1 \
  run_case 'prune-failure' 1 1 1

test_staging_cleanup_preserves_active_and_published_artifacts

printf 'daily backup retry, pruning, and staging cleanup tests passed\n'
