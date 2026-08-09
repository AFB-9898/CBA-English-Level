-- Local-only development fixtures. `supabase db reset --local` is the only
-- supported way to load this file; it is never included in remote operations.
-- These accounts are synthetic and use a development-only password.
-- Seed fixtures use a temporary local-only actor so the administrator follows
-- the same database provisioning path as a real invitation.

INSERT INTO public.admin (id, email, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000103', 'seed-actor.local@cba.test', 'Seed Actor', 'master_admin');

INSERT INTO public.administrator_provisioning (email, full_name, secret_hash, requested_role, requested_by, expires_at)
VALUES ('admin.local@cba.test', 'Local CBA Admin', decode('bbe290c66bd05f9190f360fcaa4b5ffacf77981c926b048948ebeb62aeb793dd', 'hex'), 'admin', '00000000-0000-0000-0000-000000000103', now() + interval '15 minutes');

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000101',
    'authenticated', 'authenticated', 'admin.local@cba.test',
    crypt('cba-local-dev-only', gen_salt('bf')), NOW(), '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Local CBA Admin","administrator_provisioning_secret":"0a7c1b1075d7a387f97462638c5b17f6fd61758bb28213cab2cebeb0c2347f9e"}', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000102',
    'authenticated', 'authenticated', 'student.local@cba.test',
    crypt('cba-local-dev-only', gen_salt('bf')), NOW(), '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"ci":"LOCAL-0001","full_name":"Local CBA Student","phone":"70000000"}', NOW(), NOW()
  );

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000101',
    '{"sub":"00000000-0000-0000-0000-000000000101","email":"admin.local@cba.test","email_verified":true,"phone_verified":false}',
    'email', 'admin.local@cba.test', NOW(), NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000102',
    '{"sub":"00000000-0000-0000-0000-000000000102","email":"student.local@cba.test","email_verified":true,"phone_verified":false}',
    'email', 'student.local@cba.test', NOW(), NOW(), NOW()
  );

UPDATE public.admin SET role = 'master_admin'
WHERE id = '00000000-0000-0000-0000-000000000101';

UPDATE public.admin SET is_active = false
WHERE id = '00000000-0000-0000-0000-000000000103';
