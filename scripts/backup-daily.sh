#!/usr/bin/env bash
# Creates one consistent logical backup of the application schema.
set -Eeuo pipefail
umask 077

readonly backup_root="${BACKUP_ROOT:-/var/lib/cba-supabase-backups}"
readonly pg_dump_bin="${PG_DUMP_BIN:-pg_dump}"
readonly hmac_key_file="${BACKUP_HMAC_KEY_FILE:?BACKUP_HMAC_KEY_FILE must be set}"
readonly retention_daily_days=14
readonly retention_weekly_days=56
readonly retention_monthly_days=366
readonly max_attempts=3
readonly retry_delay_seconds=300
readonly orphan_staging_minimum_age_seconds=3600
active_staging_dir=''

fail() {
  printf 'backup failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

require_private_file() {
  local file="$1"
  [[ -f "$file" && ! -L "$file" ]] || fail "required secret file is unavailable"
  [[ "$(stat -c '%a' -- "$file")" =~ ^[46]00$ ]] || fail 'secret files must have mode 0400 or 0600'
  [[ -s "$file" ]] || fail 'required secret file must not be empty'
}

process_start_time() {
  local pid="$1"
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
  awk '{ print $22 }' "/proc/$pid/stat" 2>/dev/null
}

staging_owner_is_active() {
  local staging_dir="$1" owner_pid owner_start_time current_start_time
  [[ -f "$staging_dir/.owner" && ! -L "$staging_dir/.owner" ]] || return 1
  IFS= read -r owner_pid < "$staging_dir/.owner" || return 1
  IFS= read -r owner_start_time < <(tail -n +2 "$staging_dir/.owner") || return 1
  [[ "$owner_start_time" =~ ^[0-9]+$ ]] || return 1
  current_start_time="$(process_start_time "$owner_pid" || true)"
  [[ -n "$current_start_time" && "$current_start_time" == "$owner_start_time" ]]
}

cleanup_staging() {
  local staging_dir staging_mtime now_epoch staging_age
  now_epoch="$(date -u +%s)"
  while IFS= read -r -d '' staging_dir; do
    staging_owner_is_active "$staging_dir" && continue
    staging_mtime="$(stat -c '%Y' -- "$staging_dir")" || continue
    staging_age=$((now_epoch - staging_mtime))
    if [[ -f "$staging_dir/.owner" ]] || (( staging_age >= orphan_staging_minimum_age_seconds )); then
      rm -rf -- "$staging_dir"
    fi
  done < <(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '.staging.*' -print0)
}

cleanup_active_staging() {
  [[ -z "$active_staging_dir" ]] || rm -rf -- "$active_staging_dir"
}

prune_backups() {
  local entry backup_date backup_epoch age_days weekday day_of_month now_epoch entries
  now_epoch="$(date -u +%s)"
  entries="$(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '????-??-??T??????Z*' -printf '%f\n')" || return 1

  while IFS= read -r entry; do
    backup_date="${entry:0:10}"
    backup_epoch="$(date -u -d "$backup_date" +%s 2>/dev/null || true)"
    [[ -n "$backup_epoch" ]] || continue
    age_days=$(( (now_epoch - backup_epoch) / 86400 ))
    (( age_days >= retention_daily_days )) || continue
    weekday="$(date -u -d "$backup_date" +%u)"
    day_of_month="$(date -u -d "$backup_date" +%d)"
    if { [[ "$weekday" == '7' ]] && (( age_days < retention_weekly_days )); } || \
       { [[ "$day_of_month" == '01' ]] && (( age_days < retention_monthly_days )); }; then
      continue
    fi
    rm -rf -- "$backup_root/$entry" || return 1
  done <<< "$entries"
}

for command in sha256sum openssl stat find flock awk tail; do
  require_command "$command"
done
if [[ "$pg_dump_bin" == */* ]]; then
  [[ -x "$pg_dump_bin" ]] || fail 'PG_DUMP_BIN is not executable'
else
  require_command "$pg_dump_bin"
fi

: "${PGHOST:?PGHOST must be set}"
: "${PGPORT:?PGPORT must be set}"
: "${PGDATABASE:?PGDATABASE must be set}"
: "${PGUSER:?PGUSER must be set}"
: "${PGPASSFILE:?PGPASSFILE must be set}"
[[ -z "${PGPASSWORD+x}" ]] || fail 'PGPASSWORD is forbidden; use PGPASSFILE'
require_private_file "$PGPASSFILE"
require_private_file "$hmac_key_file"

mkdir -p -- "$backup_root"
chmod 700 -- "$backup_root"
exec 9>"$backup_root/.backup.lock"
flock -n 9 || fail 'another backup is already running'
trap cleanup_active_staging EXIT
cleanup_staging

backup_once() {
  local base_backup_id collision_index final_dir dump_sha256 owner_start_time
  base_backup_id="$(date -u +%Y-%m-%dT%H%M%SZ)"
  backup_id="$base_backup_id"
  collision_index=1
  final_dir="$backup_root/$backup_id"
  while [[ -e "$final_dir" ]]; do
    backup_id="${base_backup_id}-${collision_index}"
    final_dir="$backup_root/$backup_id"
    ((collision_index += 1))
  done

  active_staging_dir="$(mktemp -d "$backup_root/.staging.XXXXXX")"
  owner_start_time="$(process_start_time "$BASHPID")" || fail 'could not determine staging owner'
  printf '%s\n%s\n' "$BASHPID" "$owner_start_time" > "$active_staging_dir/.owner"
  chmod 600 -- "$active_staging_dir/.owner"

  # A single pg_dump invocation holds one MVCC snapshot for every object it exports.
  if ! "$pg_dump_bin" --format=custom --schema=public --no-owner --no-privileges \
    > "$active_staging_dir/database.dump"; then
    printf 'backup attempt failed: consistent logical export did not complete\n' >&2
    return 1
  fi
  if [[ ! -s "$active_staging_dir/database.dump" ]]; then
    printf 'backup attempt failed: logical export is empty\n' >&2
    return 1
  fi
  chmod 600 -- "$active_staging_dir/database.dump"

  dump_sha256="$(sha256sum "$active_staging_dir/database.dump" | cut -d ' ' -f 1)"
  cat > "$active_staging_dir/manifest" <<EOF
format=cba-postgres-public-custom-v2
backup_id=$backup_id
created_utc=$backup_id
sha256 database.dump $dump_sha256
EOF
  chmod 600 -- "$active_staging_dir/manifest"
  openssl dgst -sha256 -mac HMAC -macopt "key:file:$hmac_key_file" -binary \
    "$active_staging_dir/manifest" > "$active_staging_dir/manifest.hmac" || fail 'could not authenticate manifest'
  chmod 600 -- "$active_staging_dir/manifest.hmac"

  if ! mv -T -- "$active_staging_dir" "$final_dir"; then
    printf 'backup attempt failed: could not publish backup\n' >&2
    return 1
  fi
  active_staging_dir=''
}

attempt=1
backup_id=''
while (( attempt <= max_attempts )); do
  if backup_once; then
    break
  else
    status=$?
  fi
  cleanup_active_staging
  active_staging_dir=''
  (( attempt == max_attempts )) && exit "$status"
  printf 'backup attempt %d/%d failed; retrying in %d seconds\n' \
    "$attempt" "$max_attempts" "$retry_delay_seconds" >&2
  sleep "$retry_delay_seconds"
  ((attempt += 1))
done

if ! prune_backups; then
  printf 'backup completed: %s; pruning failed\n' "$backup_id" >&2
  exit 1
fi
printf 'backup completed: %s\n' "$backup_id"
