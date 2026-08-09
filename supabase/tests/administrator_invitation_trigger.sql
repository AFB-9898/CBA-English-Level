-- Local integration contract for the real auth.users trigger and provisioning lifecycle.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(28);
SET search_path = public, extensions;

BEGIN;
RESET ROLE;

INSERT INTO public.admin (id, email, full_name, role, is_active)
VALUES ('00000000-0000-0000-0000-000000000801', 'master-invitation@test.local', 'Invitation Master', 'master_admin', true);
INSERT INTO public.admin (id, email, full_name, role, is_active)
VALUES ('00000000-0000-0000-0000-000000000808', 'other-master-invitation@test.local', 'Other Invitation Master', 'master_admin', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
SELECT lives_ok(
  $$ SELECT * FROM public.create_administrator_provisioning('  Invited-Admin@Test.Local  ', ' Invited Administrator ', 'admin', 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd') $$,
  'master creates a normalized pending administrator provisioning record'
);
RESET ROLE;

SELECT is((SELECT email FROM public.administrator_provisioning WHERE email = 'invited-admin@test.local'), 'invited-admin@test.local',
  'provisioning binds the normalized email');

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'INVITED-ADMIN@test.local', crypt('password', gen_salt('bf')),
  '{"provider":"email","providers":["email"],"role":"student"}', '{"role":"admin","full_name":"Hostile Override","ci":"MUST-NOT-CREATE"}', now(), now()
);
SELECT ok(NOT EXISTS (SELECT 1 FROM public.admin WHERE id = '00000000-0000-0000-0000-000000000802'),
  'hostile role metadata with pending provisioning cannot create an administrator');
SELECT ok(EXISTS (SELECT 1 FROM public.student WHERE id = '00000000-0000-0000-0000-000000000802'),
  'pending provisioning without its secret follows the student path');
SELECT ok(EXISTS (
  SELECT 1 FROM public.administrator_provisioning
  WHERE email = 'invited-admin@test.local' AND state = 'pending'
), 'hostile metadata does not consume pending provisioning');

INSERT INTO public.administrator_provisioning (email, full_name, secret_hash, requested_role, requested_by, expires_at)
VALUES ('secret-invited-admin@test.local', 'Secret Invited Administrator', extensions.digest('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'sha256'), 'admin', '00000000-0000-0000-0000-000000000801', now() + interval '15 minutes');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000807', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'SECRET-INVITED-ADMIN@test.local', crypt('password', gen_salt('bf')),
  '{"provider":"email","providers":["email"],"role":"student"}', '{"full_name":"Hostile Override","ci":"MUST-NOT-CREATE","administrator_provisioning_secret":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}', now(), now()
);
SELECT ok(EXISTS (SELECT 1 FROM public.admin WHERE id = '00000000-0000-0000-0000-000000000807' AND role = 'admin'),
  'a valid invitation secret creates the administrator from the auth.users trigger');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.student WHERE id = '00000000-0000-0000-0000-000000000807'),
  'secret-provisioned administrator never receives a student profile');
SELECT ok(EXISTS (
  SELECT 1 FROM public.administrator_provisioning
  WHERE email = 'secret-invited-admin@test.local' AND state = 'consumed' AND consumed_user_id = '00000000-0000-0000-0000-000000000807'
), 'the trigger atomically consumes the matched provisioning record');
SELECT ok(EXISTS (
  SELECT 1 FROM public.audit_log
  WHERE entity = 'administrator_provisioning' AND action = 'consume' AND entity_id = (SELECT id FROM public.administrator_provisioning WHERE email = 'secret-invited-admin@test.local') AND admin_id = '00000000-0000-0000-0000-000000000801'
), 'consumption preserves the requesting master administrator in the audit record');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
SELECT is((SELECT state FROM public.get_administrator_provisioning_recovery('secret-invited-admin@test.local', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')), 'consumed',
  'recovery identifies the caller-owned committed provisioning by opaque secret');
SELECT is((SELECT consumed_user_id::TEXT FROM public.get_administrator_provisioning_recovery('secret-invited-admin@test.local', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')), '00000000-0000-0000-0000-000000000807',
  'recovery returns the Auth user consumed by the matched provisioning');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000808', true);
SELECT is((SELECT count(*) FROM public.get_administrator_provisioning_recovery('secret-invited-admin@test.local', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')), 0::BIGINT,
  'another master cannot recover a provisioning requested by a different actor');
RESET ROLE;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hostile-metadata@test.local', crypt('password', gen_salt('bf')),
  '{"provider":"email","providers":["email"],"role":"admin"}', '{"role":"admin","ci":"HOSTILE-803","full_name":"Hostile Metadata","phone":"71234567"}', now(), now()
);
SELECT ok(EXISTS (SELECT 1 FROM public.student WHERE id = '00000000-0000-0000-0000-000000000803'),
  'hostile client metadata without provisioning follows the student path');

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-registration@test.local', crypt('password', gen_salt('bf')),
  '{"provider":"email","providers":["email"]}', '{"ci":"STUDENT-804","full_name":"Student Registration","phone":"71234568"}', now(), now()
);
SELECT ok(EXISTS (
  SELECT 1 FROM public.student
  WHERE id = '00000000-0000-0000-0000-000000000804' AND ci = 'STUDENT-804' AND full_name = 'Student Registration'
), 'regular student registration retains the existing metadata profile behavior');

INSERT INTO public.administrator_provisioning (email, full_name, secret_hash, requested_role, requested_by, expires_at, created_at)
VALUES ('expired-provision@test.local', 'Expired Provision', extensions.digest('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'sha256'), 'admin', '00000000-0000-0000-0000-000000000801', now() - interval '1 minute', now() - interval '1 hour');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'expired-provision@test.local', crypt('password', gen_salt('bf')),
  '{"provider":"email","providers":["email"],"role":"admin"}', '{"ci":"EXPIRED-805","full_name":"Expired Student","administrator_provisioning_secret":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}', now(), now()
);
SELECT ok(EXISTS (SELECT 1 FROM public.student WHERE id = '00000000-0000-0000-0000-000000000805'),
  'expired provisioning is rejected and the user remains a student');
SELECT is((SELECT state FROM public.administrator_provisioning WHERE email = 'expired-provision@test.local'), 'expired',
  'the trigger records expired provisioning before following the student path');

INSERT INTO public.administrator_provisioning (email, full_name, secret_hash, requested_role, requested_by, state, consumed_at, consumed_user_id, expires_at)
VALUES ('consumed-provision@test.local', 'Consumed Provision', extensions.digest('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'sha256'), 'admin', '00000000-0000-0000-0000-000000000801', 'consumed', now(), '00000000-0000-0000-0000-000000000899', now() + interval '15 minutes');
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000806', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'consumed-provision@test.local', crypt('password', gen_salt('bf')),
  '{"provider":"email","providers":["email"],"role":"admin"}', '{"ci":"CONSUMED-806","full_name":"Consumed Student","administrator_provisioning_secret":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}', now(), now()
);
SELECT ok(EXISTS (SELECT 1 FROM public.student WHERE id = '00000000-0000-0000-0000-000000000806'),
  'consumed provisioning cannot elevate a later Auth insertion');
SELECT is((SELECT state FROM public.administrator_provisioning WHERE email = 'consumed-provision@test.local'), 'consumed',
  'the consumed lifecycle state cannot be reused');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
SELECT lives_ok(
  $$ WITH provisioning AS (
       SELECT id FROM public.create_administrator_provisioning('cleanup-provision@test.local', 'Cleanup Provision', 'admin', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
     )
     SELECT public.cancel_administrator_provisioning(id) FROM provisioning $$,
  'the caller can cancel a pending record when invitation delivery fails'
);
RESET ROLE;
SELECT is((SELECT state FROM public.administrator_provisioning WHERE email = 'cleanup-provision@test.local'), 'cancelled',
  'cleanup transitions the pending provisioning record to cancelled');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
SELECT lives_ok(
  $$ SELECT * FROM public.create_administrator_provisioning('response-missing-id@test.local', 'Response Missing Id', 'admin', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') $$,
  'a provisioning response can be safely compensated by its opaque secret'
);
SELECT is(
  public.cancel_administrator_provisioning_by_secret('response-missing-id@test.local', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
  true,
  'secret cleanup cancels the pending provisioning record'
);
RESET ROLE;
SELECT is((SELECT state FROM public.administrator_provisioning WHERE email = 'response-missing-id@test.local'), 'cancelled',
  'missing-id cleanup persists the cancelled state');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
SELECT is(
  public.cancel_administrator_provisioning_by_secret('response-missing-id@test.local', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
  false,
  'secret cleanup is idempotent after cancellation'
);
SELECT lives_ok(
  $$ SELECT * FROM public.create_administrator_provisioning('response-missing-id@test.local', 'Response Missing Id Retry', 'admin', 'abababababababababababababababababababababababababababababababab') $$,
  'a later retry can create a replacement pending provisioning record'
);
SELECT throws_ok(
  $$ SELECT * FROM public.create_administrator_provisioning('response-missing-id@test.local', 'Concurrent Retry', 'admin', 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd') $$,
  '23505', 'An active administrator provisioning already exists for this email',
  'a concurrent retry cannot create a second pending provisioning record'
);
RESET ROLE;
SELECT is((SELECT count(*) FROM public.administrator_provisioning WHERE email = 'response-missing-id@test.local' AND state = 'pending'), 1::BIGINT,
  'exactly one pending provisioning record persists after concurrent retry attempts');
SELECT is((SELECT count(*) FROM public.administrator_provisioning WHERE email = 'response-missing-id@test.local'), 2::BIGINT,
  'the cancelled response and successful retry retain distinct lifecycle records');

SELECT * FROM finish();
ROLLBACK;
