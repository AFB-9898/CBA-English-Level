#!/usr/bin/env bash
# Restores an authenticated backup only into this checkout's local Supabase stack.
set -Eeuo pipefail
umask 077

usage() {
  printf 'Usage: %s --replace-local BACKUP_DIRECTORY\n' "$0" >&2
  exit 2
}

fail() {
  printf 'local restore failed: %s\n' "$1" >&2
  exit 1
}

[[ "${1:-}" == '--replace-local' && $# -eq 2 ]] || usage
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repo_root="$(git -C "$script_dir/.." rev-parse --show-toplevel 2>/dev/null)" || fail 'restore script must be located in this repository checkout'
repo_root="$(realpath "$repo_root")"
[[ "$repo_root" == "$(realpath "$script_dir/..")" ]] || fail 'restore script must be located directly under this repository checkout'
[[ -f "$repo_root/supabase/config.toml" ]] || fail 'this repository checkout has no local Supabase configuration'
cd "$repo_root"
readonly backup_dir="$(realpath "$2")"
readonly hmac_key_file="${BACKUP_HMAC_KEY_FILE:?BACKUP_HMAC_KEY_FILE must be set}"

for command in supabase docker sha256sum openssl stat awk cmp grep; do
  command -v "$command" >/dev/null 2>&1 || fail "required command is unavailable: $command"
done
[[ -d "$backup_dir" ]] || fail 'backup directory does not exist'
[[ -f "$backup_dir/manifest" && -f "$backup_dir/manifest.hmac" && -f "$backup_dir/database.dump" ]] || fail 'backup artifacts are incomplete'
[[ -f "$hmac_key_file" && ! -L "$hmac_key_file" ]] || fail 'HMAC key file is unavailable'
[[ "$(stat -c '%a' -- "$hmac_key_file")" =~ ^[46]00$ ]] || fail 'HMAC key file must have mode 0400 or 0600'
[[ -s "$hmac_key_file" ]] || fail 'HMAC key file must not be empty'

# Authenticate metadata before trusting its file name or checksum.
expected_hmac="$(mktemp)"
trap 'rm -f -- "$expected_hmac"' EXIT
openssl dgst -sha256 -mac HMAC -macopt "key:file:$hmac_key_file" -binary \
  "$backup_dir/manifest" > "$expected_hmac" || fail 'could not verify manifest authentication'
cmp -s "$expected_hmac" "$backup_dir/manifest.hmac" || fail 'manifest authentication failed'

grep -qx 'format=cba-postgres-public-custom-v2' "$backup_dir/manifest" || fail 'unsupported backup format'
expected_sha256="$(awk '$1 == "sha256" && $2 == "database.dump" { print $3; exit }' "$backup_dir/manifest")"
[[ "$expected_sha256" =~ ^[a-f0-9]{64}$ ]] || fail 'manifest does not contain a valid dump checksum'
actual_sha256="$(sha256sum "$backup_dir/database.dump" | cut -d ' ' -f 1)"
[[ "$actual_sha256" == "$expected_sha256" ]] || fail 'dump checksum verification failed'

project_id="$(awk -F '"' '/^[[:space:]]*project_id[[:space:]]*=/ { print $2; exit }' supabase/config.toml)"
[[ -n "$project_id" ]] || fail 'could not determine local Supabase project id'
container_name="supabase_db_${project_id}"
external_triggers="$(mktemp)"
container_dump='/tmp/cba-restore.dump'
cleanup() {
  rm -f -- "$expected_hmac" "$external_triggers"
  docker exec -u postgres "$container_name" rm -f "$container_dump" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Capture before restarting: `supabase start` can create a fresh local database.
if docker inspect "$container_name" >/dev/null 2>&1; then
  docker exec -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres -Atc "
    SELECT pg_get_triggerdef(t.oid) || ';'
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace trigger_schema ON trigger_schema.oid = c.relnamespace
    JOIN pg_proc function_definition ON function_definition.oid = t.tgfoid
    JOIN pg_namespace function_schema ON function_schema.oid = function_definition.pronamespace
    WHERE NOT t.tgisinternal
      AND trigger_schema.nspname <> 'public'
      AND function_schema.nspname = 'public'
    ORDER BY trigger_schema.nspname, c.relname, t.tgname;
  " > "$external_triggers" || fail 'could not preserve local managed-schema triggers'
fi

# This only addresses the named local Docker container; no URL or linked project is accepted.
supabase stop --no-backup >/dev/null 2>&1 || true
supabase start >/dev/null 2>&1 || fail 'could not start local Supabase'
docker inspect "$container_name" >/dev/null 2>&1 || fail 'local Postgres container was not found'

docker cp "$backup_dir/database.dump" "$container_name:$container_dump" || fail 'could not copy dump into local Postgres container'
docker exec "$container_name" chown postgres:postgres "$container_dump" || fail 'could not prepare local dump file'

restore_public_schema() {
  docker exec -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres -c 'DROP SCHEMA public CASCADE;' >/dev/null || return 1
  public_recreated=1
  docker exec -u postgres "$container_name" pg_restore --exit-on-error --no-owner --no-privileges \
    -d postgres "$container_dump" >/dev/null || return 1
  # Test-only failure injection proves the recovery path without corrupting a real backup.
  [[ "${RESTORE_TEST_FAIL_AFTER_PUBLIC_RECREATE:-}" != '1' ]] || return 1
}

restore_managed_triggers() {
  [[ ! -s "$external_triggers" ]] || \
    docker exec -i -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres < "$external_triggers" >/dev/null
}

recover_after_public_replacement() {
  RESTORE_TEST_FAIL_AFTER_PUBLIC_RECREATE='' restore_public_schema && restore_managed_triggers
}

public_recreated=0
if ! restore_public_schema || ! restore_managed_triggers; then
  if (( public_recreated )) && recover_after_public_replacement; then
    fail 'restore failed after replacing public; automatic recovery restored the authenticated backup and managed triggers'
  fi
  if (( public_recreated )); then
    fail 'restore failed after replacing public; automatic recovery failed and local public may be incomplete'
  fi
  fail 'could not prepare local schema restore'
fi
printf 'local restore completed: %s\n' "$(basename "$backup_dir")"
