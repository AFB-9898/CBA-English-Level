-- Local-only development fixtures. `supabase db reset --local` is the only
-- supported way to load this file; it is never included in remote operations.
-- These accounts are synthetic and use a development-only password.

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
    '{"provider":"email","providers":["email"],"role":"admin"}',
    '{"full_name":"Local CBA Admin"}', NOW(), NOW()
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

INSERT INTO public.admin (id, email, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  'admin.local@cba.test',
  'Local CBA Admin'
);
