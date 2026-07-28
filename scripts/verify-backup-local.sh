#!/usr/bin/env bash
# Exercises backup and destructive restoration against a disposable local stack only.
set -Eeuo pipefail
umask 077

repo_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tmp_root="$(mktemp -d)"
cleanup() {
  rm -rf -- "$tmp_root"
  (cd "$repo_root" && supabase stop --no-backup >/dev/null 2>&1) || true
}
trap cleanup EXIT

fail() {
  printf 'verification failed: %s\n' "$1" >&2
  exit 1
}

for command in supabase docker awk sha256sum sed openssl grep; do
  command -v "$command" >/dev/null 2>&1 || fail "required command is unavailable: $command"
done

cd "$repo_root"
supabase stop --no-backup >/dev/null 2>&1 || true
supabase start >/dev/null || fail 'could not start local Supabase'
project_id="$(awk -F '"' '/^[[:space:]]*project_id[[:space:]]*=/ { print $2; exit }' supabase/config.toml)"
[[ -n "$project_id" ]] || fail 'could not determine local Supabase project id'
container_name="supabase_db_${project_id}"
docker inspect "$container_name" >/dev/null 2>&1 || fail 'local Postgres container was not found'

# The marker proves that non-default, disposable local values survive the drill.
docker exec -i -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres >/dev/null <<'SQL'
DROP TRIGGER IF EXISTS backup_verification_trigger ON auth.users;
CREATE FUNCTION public.backup_verification_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RETURN NEW;
END;
$$;
CREATE TRIGGER backup_verification_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.backup_verification_trigger();
DROP TABLE IF EXISTS public.backup_verification_marker;
CREATE TABLE public.backup_verification_marker (id integer PRIMARY KEY, payload text NOT NULL);
INSERT INTO public.backup_verification_marker (id, payload) VALUES
  (1, 'local-only backup verification'),
  (2, 'checksum validates values, not only row counts');
SQL

data_fingerprint() {
  docker exec -u postgres "$container_name" pg_dump --data-only --schema=public --no-owner --no-privileges -d postgres |
    sed -E '/^\\(un)?restrict /d' | sha256sum | cut -d ' ' -f 1
}

before_data_fingerprint="$(data_fingerprint)"

# A local-only pg_dump adapter keeps the test independent of host client packages.
local_pg_dump="$tmp_root/pg_dump-local"
printf '%s\n' '#!/usr/bin/env bash' 'exec docker exec -i -u postgres "$LOCAL_SUPABASE_DB_CONTAINER" pg_dump "$@"' > "$local_pg_dump"
chmod 700 "$local_pg_dump"
pgpass_file="$tmp_root/pgpass"
hmac_key_file="$tmp_root/backup-hmac.key"
dd if=/dev/urandom of="$pgpass_file" bs=32 count=1 status=none
dd if=/dev/urandom of="$hmac_key_file" bs=32 count=1 status=none
chmod 600 "$pgpass_file" "$hmac_key_file"

empty_hmac_key_file="$tmp_root/empty-hmac.key"
: > "$empty_hmac_key_file"
chmod 600 "$empty_hmac_key_file"
if BACKUP_ROOT="$tmp_root/empty-key-backups" \
  BACKUP_HMAC_KEY_FILE="$empty_hmac_key_file" \
  PG_DUMP_BIN="$local_pg_dump" \
  PGHOST=local PGPORT=5432 PGDATABASE=postgres PGUSER=postgres PGPASSFILE="$pgpass_file" \
  "$repo_root/scripts/backup-daily.sh" >"$tmp_root/empty-key.out" 2>&1; then
  fail 'backup accepted an empty HMAC key file'
fi
grep -qx 'backup failed: required secret file must not be empty' "$tmp_root/empty-key.out" || fail 'empty HMAC key rejection was ambiguous'

wrong_checkout="$tmp_root/wrong-checkout"
mkdir -p "$wrong_checkout/scripts"
cp "$repo_root/scripts/restore-backup-local.sh" "$wrong_checkout/scripts/"
chmod 700 "$wrong_checkout/scripts/restore-backup-local.sh"
if BACKUP_HMAC_KEY_FILE="$hmac_key_file" \
  "$wrong_checkout/scripts/restore-backup-local.sh" --replace-local "$tmp_root" >"$tmp_root/wrong-checkout.out" 2>&1; then
  fail 'restore accepted a script outside this repository checkout'
fi
grep -qx 'local restore failed: restore script must be located in this repository checkout' "$tmp_root/wrong-checkout.out" || fail 'wrong checkout rejection was ambiguous'

BACKUP_ROOT="$tmp_root/backups" \
BACKUP_HMAC_KEY_FILE="$hmac_key_file" \
LOCAL_SUPABASE_DB_CONTAINER="$container_name" \
PG_DUMP_BIN="$local_pg_dump" \
PGHOST=local PGPORT=5432 PGDATABASE=postgres PGUSER=postgres PGPASSFILE="$pgpass_file" \
  "$repo_root/scripts/backup-daily.sh"
backup_dir="$(find "$tmp_root/backups" -mindepth 1 -maxdepth 1 -type d -name '????-??-??T??????Z*' -print -quit)"
[[ -n "$backup_dir" ]] || fail 'no backup directory was created'

BACKUP_HMAC_KEY_FILE="$hmac_key_file" "$repo_root/scripts/restore-backup-local.sh" --replace-local "$backup_dir"

after_data_fingerprint="$(data_fingerprint)"
[[ "$before_data_fingerprint" == "$after_data_fingerprint" ]] || fail 'public data checksum changed after restore'
marker_values="$(docker exec -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres -tAc "SELECT string_agg(id || ':' || payload, ',' ORDER BY id) FROM public.backup_verification_marker")"
[[ "$marker_values" == '1:local-only backup verification,2:checksum validates values, not only row counts' ]] || fail 'representative marker values were not restored'
marker_definition="$(docker exec -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres -tAc "SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'backup_verification_marker'")"
[[ "$marker_definition" == 'id:integer:NO,payload:text:NO' ]] || fail 'representative marker table definition was not restored'
trigger_count="$(docker exec -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres -tAc "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'auth' AND c.relname = 'users' AND t.tgname = 'backup_verification_trigger' AND NOT t.tgisinternal")"
[[ "$trigger_count" == '1' ]] || fail 'managed-schema trigger was not replayed'

if RESTORE_TEST_FAIL_AFTER_PUBLIC_RECREATE=1 BACKUP_HMAC_KEY_FILE="$hmac_key_file" \
  "$repo_root/scripts/restore-backup-local.sh" --replace-local "$backup_dir" >"$tmp_root/recovery.out" 2>&1; then
  fail 'injected post-public-recreate failure did not fail the restore command'
fi
grep -qx 'local restore failed: restore failed after replacing public; automatic recovery restored the authenticated backup and managed triggers' "$tmp_root/recovery.out" || fail 'post-public-recreate recovery status was ambiguous'
[[ "$(data_fingerprint)" == "$before_data_fingerprint" ]] || fail 'automatic recovery did not restore public data'
marker_values="$(docker exec -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres -tAc "SELECT string_agg(id || ':' || payload, ',' ORDER BY id) FROM public.backup_verification_marker")"
[[ "$marker_values" == '1:local-only backup verification,2:checksum validates values, not only row counts' ]] || fail 'automatic recovery did not restore representative marker values'
marker_definition="$(docker exec -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres -tAc "SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'backup_verification_marker'")"
[[ "$marker_definition" == 'id:integer:NO,payload:text:NO' ]] || fail 'automatic recovery did not restore the marker table definition'
trigger_count="$(docker exec -u postgres "$container_name" psql -v ON_ERROR_STOP=1 -d postgres -tAc "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'auth' AND c.relname = 'users' AND t.tgname = 'backup_verification_trigger' AND NOT t.tgisinternal")"
[[ "$trigger_count" == '1' ]] || fail 'automatic recovery did not replay managed-schema triggers'
printf 'local backup and destructive restoration verification passed\n'
