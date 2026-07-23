-- Contract tests for migrations 012 and 014. Run after `supabase db reset` with psql.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(13);
SET search_path = public, extensions;

BEGIN;
RESET ROLE;
TRUNCATE public.student_answer, public.exam_question_option, public.exam_level_snapshot, public.exam_question, public.question_option,
  public.exam, public.question, public.student, public.audit_log;

INSERT INTO public.student (id, ci, full_name, email) VALUES
  ('00000000-0000-0000-0000-000000000120', 'DASH-120', 'Dashboard Student', 'dashboard.student@test.local'),
  ('00000000-0000-0000-0000-000000000121', 'DASH-121', 'Other Student', 'other.student@test.local'),
  ('00000000-0000-0000-0000-000000000122', 'DASH-122', 'Pending Student', 'pending.student@test.local'),
  ('00000000-0000-0000-0000-000000000129', 'DASH-129', 'Completed Student', 'completed.student@test.local');

INSERT INTO public.level (id, code, name, min_score, max_score, description, version, is_active)
VALUES ('00000000-0000-0000-0000-000000000123', 'HX', 'Historical Level', 0, 100, NULL, 1, FALSE);

INSERT INTO public.exam (id, student_id, completed_at, score, level_id, status) VALUES
  ('00000000-0000-0000-0000-000000000124', '00000000-0000-0000-0000-000000000120', CURRENT_DATE - INTERVAL '2 days', 73, '00000000-0000-0000-0000-000000000123', 'completed'),
  ('00000000-0000-0000-0000-000000000126', '00000000-0000-0000-0000-000000000120', NULL, NULL, NULL, 'in_progress'),
  ('00000000-0000-0000-0000-000000000127', '00000000-0000-0000-0000-000000000120', NULL, NULL, NULL, 'pending'),
  ('00000000-0000-0000-0000-000000000128', '00000000-0000-0000-0000-000000000122', NULL, NULL, NULL, 'pending'),
  ('00000000-0000-0000-0000-000000000130', '00000000-0000-0000-0000-000000000129', (date_trunc('day', NOW() AT TIME ZONE 'America/La_Paz') AT TIME ZONE 'America/La_Paz') + INTERVAL '12 hours', 88, (SELECT id FROM public.level WHERE code = 'B1' AND version = 1), 'completed');

SELECT is(public.fn_cba_business_date(TIMESTAMPTZ '2026-01-01 03:30:00+00'), DATE '2025-12-31', 'CBA business date remains on the prior local day before the UTC boundary');
SELECT is(public.fn_cba_business_date(TIMESTAMPTZ '2026-01-01 04:30:00+00'), DATE '2026-01-01', 'CBA business date advances at the America/La_Paz boundary');
SELECT ok(pg_get_functiondef('public.get_student_dashboard()'::regprocedure) LIKE '%fn_cba_business_date(completed_at)%', 'dashboard uses the CBA business-date function');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000120', TRUE);
SELECT is((SELECT student_full_name FROM public.get_student_dashboard()), 'Dashboard Student', 'dashboard projects only the authenticated student profile');
SELECT is((SELECT attempt_count FROM public.get_student_dashboard()), 3::BIGINT, 'attempt count includes all own exams');
SELECT is((SELECT exam_state FROM public.get_student_dashboard()), 'in_progress', 'own in-progress exam takes state priority');
SELECT is((SELECT latest_result_score FROM public.get_student_dashboard()), 73, 'latest completed result is returned without exam content');
SELECT is((SELECT assigned_level_code FROM public.get_student_dashboard()), 'HX', 'latest result keeps its persisted historical level code');
SELECT is((SELECT assigned_level_name FROM public.get_student_dashboard()), 'Historical Level', 'latest result keeps its persisted historical level name');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000129', TRUE);
SELECT is((SELECT exam_state FROM public.get_student_dashboard()), 'completed', 'own completion today maps to completed');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000122', TRUE);
SELECT is((SELECT exam_state FROM public.get_student_dashboard()), 'available', 'pending exams map to available');
SELECT ok((SELECT latest_result_score IS NULL AND assigned_level_code IS NULL FROM public.get_student_dashboard()), 'student without a completed exam has no result');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000199', TRUE);
SELECT throws_ok($$ SELECT * FROM public.get_student_dashboard() $$, '42501', 'Student access required', 'non-student cannot access the dashboard');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
