-- Contract tests for migration 021. Run after `supabase db reset --local` with psql.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(20);
SET search_path = public, extensions;

BEGIN;
RESET ROLE;
INSERT INTO public.admin (id, email, full_name, role, is_active) VALUES
  ('00000000-0000-0000-0000-000000000901', 'dashboard-master@test.local', 'Dashboard Master', 'master_admin', TRUE),
  ('00000000-0000-0000-0000-000000000902', 'dashboard-admin@test.local', 'Dashboard Admin', 'admin', TRUE);
TRUNCATE public.exam_attempt_exception, public.student_answer, public.exam_question_option, public.exam_level_snapshot, public.exam_question, public.question_option,
  public.exam, public.question, public.student, public.audit_log;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', TRUE);
SELECT is(public.get_admin_dashboard_statistics() -> 'totals', '{"exams": 0, "students": 0}'::JSONB, 'no-data totals default to zero');
SELECT ok((public.get_admin_dashboard_statistics() ->> 'completed_today')::INTEGER = 0 AND (public.get_admin_dashboard_statistics() ->> 'completed_score_average')::NUMERIC = 0, 'no-data completed metrics default to zero');
SELECT is(public.get_admin_dashboard_statistics() -> 'recent_completed', '[]'::JSONB, 'no-data recent rows default to an empty array');
RESET ROLE;
INSERT INTO public.student (id, ci, full_name, email) VALUES
  ('00000000-0000-0000-0000-000000000910', 'DASH-910', 'First Student', 'first.dashboard@test.local'),
  ('00000000-0000-0000-0000-000000000911', 'DASH-911', 'Second Student', 'second.dashboard@test.local'),
  ('00000000-0000-0000-0000-000000000912', 'DASH-912', 'Third Student', 'third.dashboard@test.local');
INSERT INTO public.exam (id, student_id, completed_at, score, level_id, status) VALUES
  ('00000000-0000-0000-0000-000000000920', '00000000-0000-0000-0000-000000000910', clock_timestamp() - INTERVAL '15 minutes', 60, (SELECT id FROM public.level WHERE code = 'B1' AND is_active), 'completed'),
  ('00000000-0000-0000-0000-000000000921', '00000000-0000-0000-0000-000000000911', clock_timestamp() - INTERVAL '1 hour', 80, (SELECT id FROM public.level WHERE code = 'B2' AND is_active), 'completed'),
  ('00000000-0000-0000-0000-000000000922', '00000000-0000-0000-0000-000000000912', clock_timestamp() - INTERVAL '2 days', 100, (SELECT id FROM public.level WHERE code = 'C1' AND is_active), 'completed'),
  ('00000000-0000-0000-0000-000000000923', '00000000-0000-0000-0000-000000000912', NULL, NULL, NULL, 'pending');
INSERT INTO public.exam (id, student_id, completed_at, score, level_id, status)
SELECT ('00000000-0000-0000-0000-' || lpad((1000 + value)::TEXT, 12, '0'))::UUID, '00000000-0000-0000-0000-000000000910', clock_timestamp() - INTERVAL '2 days' - value * INTERVAL '1 hour', 50, (SELECT id FROM public.level WHERE code = 'A1' AND is_active), 'completed'
FROM generate_series(1, 9) AS value;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', TRUE);
UPDATE public.level SET is_active = FALSE WHERE code = 'C1' AND is_active;
SET LOCAL ROLE authenticated;
SELECT lives_ok($$ SELECT public.get_admin_dashboard_statistics() $$, 'master administrator can load dashboard statistics');
SELECT is((public.get_admin_dashboard_statistics() #>> '{totals,students}')::INTEGER, 3, 'dashboard totals include all students');
SELECT is((public.get_admin_dashboard_statistics() #>> '{totals,exams}')::INTEGER, 13, 'dashboard totals include all exams');
SELECT is((public.get_admin_dashboard_statistics() ->> 'completed_today')::INTEGER, 2, 'completed-today total uses the CBA business day');
SELECT is((public.get_admin_dashboard_statistics() ->> 'completed_score_average')::NUMERIC, 57.5::NUMERIC, 'completed score average is rounded to one decimal');
SELECT is(jsonb_array_length(public.get_admin_dashboard_statistics() -> 'recent_completed'), 10, 'recent completed rows are bounded to ten');
SELECT is(public.get_admin_dashboard_statistics() #>> '{recent_completed,0,id}', '00000000-0000-0000-0000-000000000920', 'recent completed rows are ordered newest first');
SELECT ok(EXISTS (SELECT 1 FROM jsonb_array_elements(public.get_admin_dashboard_statistics() -> 'level_distribution') item WHERE item ->> 'name' = 'C1' AND (item ->> 'count')::INTEGER = 1), 'master administrator sees completed assignments to inactive levels');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', TRUE);
SELECT lives_ok($$ SELECT public.get_admin_dashboard_statistics() $$, 'active administrator can load dashboard statistics');
SELECT ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.get_admin_dashboard_statistics() -> 'level_distribution') item WHERE item ->> 'name' = 'C1'), 'administrator distribution excludes inactive levels');
SELECT is((SELECT (item ->> 'percentage')::INTEGER FROM jsonb_array_elements(public.get_admin_dashboard_statistics() -> 'level_distribution') item WHERE item ->> 'name' = 'B1'), 8, 'distribution percentage uses all completed exams as its denominator');
SELECT throws_ok($$ SELECT COUNT(*) FROM public.exam $$, '42501', NULL, 'administrator cannot read exam rows directly');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exam' AND policyname = 'exam_select_admin'), 'obsolete administrator exam select policy is removed');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000910', TRUE);
SELECT throws_ok($$ SELECT public.get_admin_dashboard_statistics() $$, '42501', 'Permission denied', 'student caller cannot load dashboard statistics');
SELECT throws_ok($$ SELECT COUNT(*) FROM public.exam $$, '42501', NULL, 'student cannot read exam rows directly');
RESET ROLE;
SELECT ok(has_function_privilege('authenticated', 'public.get_admin_dashboard_statistics()', 'EXECUTE'), 'only authenticated callers receive execute access');
SELECT ok(NOT has_function_privilege('anon', 'public.get_admin_dashboard_statistics()', 'EXECUTE'), 'anonymous callers cannot execute dashboard statistics');
SELECT * FROM finish();
ROLLBACK;
