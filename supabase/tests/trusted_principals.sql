-- Contract tests for migration 011. Run after `supabase db reset` with psql.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(10);
SET search_path = public, extensions;

BEGIN;
RESET ROLE;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hostile-student@test.local', crypt('password', gen_salt('bf')), '{"provider":"email","providers":["email"]}', '{"role":"admin","ci":"HOSTILE-201","full_name":"Hostile Student"}', now(), now()),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'provisioned-admin@test.local', crypt('password', gen_salt('bf')), '{"provider":"email","providers":["email"],"role":"admin"}', '{}', now(), now());

INSERT INTO public.admin (id, email, full_name)
VALUES ('00000000-0000-0000-0000-000000000202', 'provisioned-admin@test.local', 'Provisioned Admin');

SELECT ok(EXISTS (SELECT 1 FROM public.student WHERE id = '00000000-0000-0000-0000-000000000201'),
  'hostile role metadata cannot suppress student creation');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.admin WHERE id = '00000000-0000-0000-0000-000000000201'),
  'hostile role metadata cannot create an administrator');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.student WHERE id = '00000000-0000-0000-0000-000000000202'),
  'trusted administrator provisioning does not require student metadata');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', TRUE);
SELECT is((public.get_current_principal() ->> 'role'), 'student',
  'student principal is resolved from public.student, not metadata');
SELECT is((SELECT COUNT(*) FROM public.student WHERE id = '00000000-0000-0000-0000-000000000201'), 1::BIGINT,
  'student can read its own profile through RLS');
UPDATE public.student SET phone = '71234567' WHERE id = '00000000-0000-0000-0000-000000000201';
SELECT is((SELECT phone FROM public.student WHERE id = '00000000-0000-0000-0000-000000000201'), '71234567',
  'student can update its own profile through RLS');
SELECT throws_ok(
  $$ INSERT INTO public.student (id, ci, full_name, email) VALUES ('00000000-0000-0000-0000-000000000299', 'ARBITRARY-299', 'Arbitrary Student', 'arbitrary@test.local') $$,
  '42501', NULL, 'authenticated clients cannot create arbitrary student records'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', TRUE);
SELECT is((public.get_current_principal() ->> 'role'), 'admin',
  'administrator principal is resolved from public.admin, not metadata');
SELECT ok((public.get_current_principal() ->> 'admin_name') = 'Provisioned Admin',
  'administrator principal includes its database display name');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.get_current_principal() $$, '42501', NULL,
  'unauthenticated callers cannot resolve a principal');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
