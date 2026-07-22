-- Permanent contract tests for migration 008. Run after `supabase db reset` with psql.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(9);
SET search_path = public, extensions;

INSERT INTO public.admin (id, email, full_name)
VALUES ('00000000-0000-0000-0000-000000000005', 'reports-admin@test.local', 'Reports Admin')
ON CONFLICT (id) DO NOTHING;
DELETE FROM public.admin WHERE id = '00000000-0000-0000-0000-000000000006';

BEGIN;
RESET ROLE;
TRUNCATE public.student_answer, public.exam_question, public.question_option,
  public.exam, public.question, public.student, public.audit_log;
INSERT INTO public.student (id, ci, full_name, email) VALUES
  ('00000000-0000-0000-0000-000000000020', 'REPORT-A1', 'Alpha Student', 'alpha.reports@test.local'),
  ('00000000-0000-0000-0000-000000000021', 'REPORT-B1', 'Beta Student', 'beta.reports@test.local');
INSERT INTO public.exam (id, student_id, completed_at, score, level_id, status) VALUES
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020', '2026-07-10T12:00:00Z', 10, (SELECT id FROM public.level WHERE code = 'A1' AND version = 1), 'completed'),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000021', '2026-07-11T12:00:00Z', 99, (SELECT id FROM public.level WHERE code = 'B1' AND version = 1), 'completed'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000021', NULL, NULL, NULL, 'pending');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', TRUE);
SELECT throws_ok(
  $$ SELECT * FROM public.get_admin_exam_report() $$,
  '42501',
  'Administrator access required',
  'non-administrator cannot access report data'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', TRUE);
SELECT ok((SELECT COUNT(*) FROM public.get_admin_exam_report('2026-07-11', '2026-07-11', NULL, 'completed', 1, 25)) = 1,
  'completed-date and status filters are inclusive');
SELECT ok((SELECT student_ci FROM public.get_admin_exam_report(NULL, NULL, (SELECT id FROM public.level WHERE code = 'B1' AND version = 1), NULL, 1, 25)) = 'REPORT-B1',
  'assigned CEFR level filter selects the persisted level');
SELECT ok((SELECT level_code FROM public.get_admin_exam_report(NULL, NULL, NULL, NULL, 1, 25) WHERE exam_id = '00000000-0000-0000-0000-000000000031') = 'B1',
  'report reads the historically assigned level even when the stored score is outside its active range');
SELECT ok((SELECT COUNT(*) FROM public.get_admin_exam_report(NULL, NULL, NULL, 'pending', 1, 25)) = 1,
  'status filter includes non-completed exams');
SELECT throws_ok($$ SELECT * FROM public.get_admin_exam_report('2026-07-12', '2026-07-11') $$, NULL, 'Completed date range is invalid', 'invalid date range is rejected');
SELECT throws_ok($$ SELECT * FROM public.get_admin_exam_report(NULL, NULL, NULL, NULL, 0, 25) $$, NULL, 'Page must be at least one', 'invalid page is rejected');
SELECT throws_ok($$ SELECT * FROM public.get_admin_exam_report(NULL, NULL, NULL, NULL, 1, 5001) $$, NULL, 'Page size must be between one and 5000', 'unbounded export size is rejected');
SELECT ok(has_table_privilege('authenticated', 'public.student', 'SELECT'), 'authenticated student profile reads are constrained by the self row policy');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
