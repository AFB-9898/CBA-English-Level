-- Local-only contract tests for migration 019. Fixture data is rolled back.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(24);
SET search_path = public, extensions;

BEGIN;
RESET ROLE;
TRUNCATE public.exam_attempt_exception, public.student_answer, public.exam_question_option,
  public.exam_level_snapshot, public.exam_question, public.exam, public.question_option,
  public.question, public.student, public.audit_log RESTART IDENTITY CASCADE;
INSERT INTO public.student (id, ci, full_name, email) VALUES
  ('00000000-0000-0000-0000-000000000801', 'EX-801', 'Exception Student', 'exception-801@test.local'),
  ('00000000-0000-0000-0000-000000000802', 'EX-802', 'Revoked Student', 'exception-802@test.local'),
  ('00000000-0000-0000-0000-000000000803', 'EX-803', 'Expired Student', 'exception-803@test.local');
INSERT INTO public.admin (id, email, full_name, role, is_active) VALUES
  ('00000000-0000-0000-0000-000000000804', 'exception-master@test.local', 'Exception Master', 'master_admin', TRUE),
  ('00000000-0000-0000-0000-000000000805', 'exception-admin@test.local', 'Exception Admin', 'admin', TRUE);
\ir fixtures/student_exam_lifecycle.sql
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000804', TRUE);
UPDATE public.exam_config SET questions_per_exam = 1, time_limit_minutes = 30, revision = revision + 1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000804', TRUE);
SELECT throws_ok($$ SELECT * FROM public.grant_exam_attempt_exception('00000000-0000-0000-0000-000000000801', 'short') $$, '22023', 'Exception reason must contain between 10 and 500 characters', 'reason has a mandatory lower bound');
CREATE TEMP TABLE granted AS SELECT * FROM public.grant_exam_attempt_exception('00000000-0000-0000-0000-000000000801', 'Student had a documented technical interruption.');
SELECT is((SELECT state FROM granted), 'pending', 'master creates a pending exception');
SELECT ok((SELECT expires_at > granted_at FROM granted), 'grant has a bounded same-day expiry');
SELECT throws_ok($$ SELECT * FROM public.grant_exam_attempt_exception('00000000-0000-0000-0000-000000000801', 'A second documented technical interruption.') $$, '23505', NULL, 'only one grant exists for a student and CBA day');
RESET ROLE;
SELECT is((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'exam_attempt_exception' AND action = 'grant'), 1::BIGINT, 'grant writes an audit event');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000805', TRUE);
SELECT throws_ok($$ SELECT * FROM public.get_exam_attempt_exception('00000000-0000-0000-0000-000000000801') $$, '42501', 'Permission denied', 'standard admin cannot view exceptions');
SELECT throws_ok($$ SELECT * FROM public.grant_exam_attempt_exception('00000000-0000-0000-0000-000000000802', 'Standard administrator must not grant exceptions.') $$, '42501', 'Permission denied', 'standard admin cannot grant exceptions');
SELECT throws_ok($$ SELECT * FROM public.exam_attempt_exception $$, '42501', NULL, 'authenticated users have no direct exception access');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', TRUE);
CREATE TEMP TABLE first_attempt AS SELECT public.start_exam('00000000-0000-0000-0000-000000000811') AS payload;
SELECT is((SELECT public.start_exam('00000000-0000-0000-0000-000000000811')->>'attempt_id'), (SELECT payload->>'attempt_id' FROM first_attempt), 'first start remains request-id idempotent');
RESET ROLE;
SELECT is((SELECT state FROM public.exam_attempt_exception WHERE student_id = '00000000-0000-0000-0000-000000000801'), 'pending', 'normal first attempt does not consume a grant');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', TRUE);
SELECT public.submit_exam((SELECT (payload->>'attempt_id')::UUID FROM first_attempt));
SELECT is((SELECT exam_state FROM public.get_student_dashboard()), 'available', 'pending valid exception enables the student dashboard start action');
CREATE TEMP TABLE extra_attempt AS SELECT public.start_exam('00000000-0000-0000-0000-000000000812') AS payload;
RESET ROLE;
SELECT is((SELECT state FROM public.exam_attempt_exception WHERE student_id = '00000000-0000-0000-0000-000000000801'), 'consumed', 'extra attempt consumes the row in start_exam');
SELECT ok((SELECT consumed_exam_id = (payload->>'attempt_id')::UUID FROM public.exam_attempt_exception, extra_attempt WHERE student_id = '00000000-0000-0000-0000-000000000801'), 'consumed grant records the extra exam');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', TRUE);
SELECT is((SELECT public.start_exam('00000000-0000-0000-0000-000000000812')->>'attempt_id'), (SELECT payload->>'attempt_id' FROM extra_attempt), 'extra start retry remains idempotent after consumption');
SELECT public.submit_exam((SELECT (payload->>'attempt_id')::UUID FROM extra_attempt));
SELECT throws_ok($$ SELECT public.start_exam('00000000-0000-0000-0000-000000000813') $$, '23505', 'Student already completed an exam on this CBA business day', 'one extra attempt is the daily maximum');
RESET ROLE;
SELECT is((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'exam_attempt_exception' AND action = 'consume'), 1::BIGINT, 'consumption writes an audit event');

INSERT INTO public.exam (student_id, completed_at, score, level_id, status) VALUES ('00000000-0000-0000-0000-000000000802', clock_timestamp(), 0, (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1), 'completed');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000804', TRUE);
CREATE TEMP TABLE revocable AS SELECT * FROM public.grant_exam_attempt_exception('00000000-0000-0000-0000-000000000802', 'Documented correction before the additional attempt.');
SELECT public.revoke_exam_attempt_exception((SELECT exception_id FROM revocable));
RESET ROLE;
SELECT is((SELECT state FROM public.exam_attempt_exception WHERE id = (SELECT exception_id FROM revocable)), 'revoked', 'master can revoke a pending exception');
SELECT is((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'exam_attempt_exception' AND action = 'revoke'), 1::BIGINT, 'revocation writes an audit event');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000802', TRUE);
SELECT throws_ok($$ SELECT public.start_exam('00000000-0000-0000-0000-000000000821') $$, '23505', 'Student already completed an exam on this CBA business day', 'revoked exception cannot be used');

RESET ROLE;
INSERT INTO public.exam (student_id, completed_at, score, level_id, status) VALUES ('00000000-0000-0000-0000-000000000803', clock_timestamp(), 0, (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1), 'completed');
INSERT INTO public.exam_attempt_exception (student_id, cba_business_date, reason, granted_by, granted_at, expires_at)
VALUES ('00000000-0000-0000-0000-000000000803', public.fn_cba_business_date(clock_timestamp()), 'An expired documented administrative exception.', '00000000-0000-0000-0000-000000000804', clock_timestamp() - interval '2 hours', clock_timestamp() - interval '1 hour');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000803', TRUE);
SELECT is((SELECT exam_state FROM public.get_student_dashboard()), 'completed', 'expired exception does not enable the dashboard');
SELECT throws_ok($$ SELECT public.start_exam('00000000-0000-0000-0000-000000000831') $$, '23505', 'Student already completed an exam on this CBA business day', 'expired exception cannot be used');
RESET ROLE;
SELECT throws_ok($$ UPDATE public.exam_attempt_exception SET reason = 'Changed reason after consumption' WHERE student_id = '00000000-0000-0000-0000-000000000801' $$, '42501', 'Exam attempt exceptions may only be consumed or revoked once', 'exception records are immutable after transition');
SELECT ok(pg_get_functiondef('public.start_exam(uuid)'::regprocedure) LIKE '%FOR UPDATE%' AND pg_get_functiondef('public.start_exam(uuid)'::regprocedure) LIKE '%student-exam:%', 'start serializes concurrent starts and locks the exception row');
SELECT ok(pg_get_functiondef('public.grant_exam_attempt_exception(uuid,character varying)'::regprocedure) LIKE '%exam-exception:%', 'grant serializes concurrent master grants');
SELECT * FROM finish();
ROLLBACK;
