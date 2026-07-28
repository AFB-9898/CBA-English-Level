-- Permanent contract tests for migration 016. Run after `supabase db reset` with psql.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(20);
SET search_path = public, extensions;

BEGIN;
RESET ROLE;
INSERT INTO public.admin (id, email, full_name)
VALUES ('00000000-0000-0000-0000-000000000016', 'students-admin@test.local', 'Students Admin')
ON CONFLICT (id) DO NOTHING;
TRUNCATE public.student_answer, public.exam_question_option, public.exam_level_snapshot, public.exam_question,
  public.question_option, public.exam, public.question, public.student, public.audit_log;
INSERT INTO public.student (id, ci, full_name, email, phone) VALUES
  ('00000000-0000-0000-0000-000000000161', 'STUDENT-A', 'Ada Student', 'ada.students@test.local', '71234567'),
  ('00000000-0000-0000-0000-000000000162', 'STUDENT-B', 'Bea Student', 'bea.students@test.local', NULL);
INSERT INTO public.exam (id, student_id, started_at, completed_at, score, level_id, status) VALUES
  ('00000000-0000-0000-0000-000000000163', '00000000-0000-0000-0000-000000000161', '2026-07-01T10:00:00Z', '2026-07-01T10:20:00Z', 55, (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1), 'completed');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000199', TRUE);
SELECT throws_ok($$ SELECT * FROM public.get_admin_students() $$, '42501', 'Administrator access required', 'non-administrators cannot list students');
SELECT throws_ok($$ SELECT * FROM public.get_admin_student_detail('00000000-0000-0000-0000-000000000161') $$, '42501', 'Administrator access required', 'non-administrators cannot read student detail');
SELECT throws_ok($$ SELECT * FROM public.update_admin_student_profile('00000000-0000-0000-0000-000000000161', 'Changed', NULL) $$, '42501', 'Administrator access required', 'non-administrators cannot edit students');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000016', TRUE);
SELECT is((SELECT COUNT(*) FROM public.get_admin_students('ada', NULL, NULL, 2)), 1::BIGINT, 'admin search is limited to profile projections');
SELECT is((SELECT full_name FROM public.get_admin_students(NULL, NULL, NULL, 1) LIMIT 1), 'Ada Student', 'student list is ordered and paged');
SELECT is((SELECT email FROM public.get_admin_student_detail('00000000-0000-0000-0000-000000000161')), 'ada.students@test.local', 'admin detail returns the allowed profile projection');
SELECT is((SELECT score FROM public.get_admin_student_attempts('00000000-0000-0000-0000-000000000161', 50)), 55, 'attempt history exposes only read-only summary fields');
SELECT is((SELECT full_name FROM public.update_admin_student_profile('00000000-0000-0000-0000-000000000161', ' Ada Updated ', '70123456')), 'Ada Updated', 'admin can update the permitted name field');
SELECT is((SELECT phone FROM public.get_admin_student_detail('00000000-0000-0000-0000-000000000161')), '70123456', 'admin can update the permitted phone field');
SELECT ok((SELECT admin_id = auth.uid()
  AND details = '{"before":{"full_name":"Ada Student","phone":"71234567"},"after":{"full_name":"Ada Updated","phone":"70123456"}}'::jsonb
  FROM public.audit_log WHERE entity = 'student' AND action = 'update' LIMIT 1), 'profile update audit records the acting admin and safe before/after fields');
SELECT is((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'student' AND action = 'update'), 1::BIGINT, 'one changed profile update creates one audit entry');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.audit_log WHERE entity = 'student' AND action = 'update' AND (details::TEXT LIKE '%email%' OR details::TEXT LIKE '%ci%')), 'student profile audit excludes identity fields');
SELECT is((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'student' AND action = 'update'), 1::BIGINT, 'a no-op profile save does not create an audit entry')
  FROM public.update_admin_student_profile('00000000-0000-0000-0000-000000000161', 'Ada Updated', '70123456');
SELECT throws_ok($$ SELECT * FROM public.update_admin_student_profile('00000000-0000-0000-0000-000000000199', 'Missing Student', NULL) $$, 'P0002', 'Student profile no longer exists', 'stale student profile updates fail instead of returning an empty success');
SELECT throws_ok($$ SELECT * FROM public.update_admin_student_profile('00000000-0000-0000-0000-000000000161', '', NULL) $$, '22023', 'Student full name must contain between one and 200 characters', 'blank names are rejected');
SELECT throws_ok($$ SELECT * FROM public.update_admin_student_profile('00000000-0000-0000-0000-000000000161', 'Ada Updated', '123') $$, '22023', 'Student phone must contain seven to 15 digits', 'invalid phones are rejected');
SELECT ok(NOT has_table_privilege('authenticated', 'public.student', 'DELETE'), 'authenticated has no direct student deletion privilege');
SELECT ok(has_column_privilege('authenticated', 'public.student', 'full_name', 'UPDATE'), 'permitted profile name updates have an explicit column privilege');
SELECT ok(NOT has_column_privilege('authenticated', 'public.student', 'email', 'UPDATE'), 'identity email updates are not granted');

RESET ROLE;
SELECT throws_ok($$ DELETE FROM public.student WHERE id = '00000000-0000-0000-0000-000000000161' $$, '23503', 'Cannot delete a student with exam records', 'students with attempts cannot be deleted even through a privileged path');
SELECT * FROM finish();
ROLLBACK;
