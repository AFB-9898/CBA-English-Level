-- Local-only secure lifecycle validation. All fixture data is rolled back.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(31);
SET search_path = public, extensions;

BEGIN;
RESET ROLE;
TRUNCATE public.student_answer, public.exam_question_option, public.exam_level_snapshot,
  public.exam_question, public.exam, public.question_option, public.question, public.student,
  public.exam_config_snapshot, public.audit_log RESTART IDENTITY CASCADE;

INSERT INTO public.student (id, ci, full_name, email) VALUES
  ('00000000-0000-0000-0000-000000000301', 'LIFE-301', 'Lifecycle Fixture One', 'lifecycle-301@test.local'),
  ('00000000-0000-0000-0000-000000000302', 'LIFE-302', 'Lifecycle Fixture Two', 'lifecycle-302@test.local');
\ir fixtures/student_exam_lifecycle.sql
UPDATE public.exam_config
SET questions_per_exam = 1, time_limit_minutes = 30, passing_score = 50, revision = revision + 1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', TRUE);
CREATE TEMP TABLE first_start AS
  SELECT public.start_exam('00000000-0000-0000-0000-000000000341') AS payload;
SELECT ok((SELECT payload ? 'attempt_id' AND jsonb_array_length(payload->'questions') = 1 FROM first_start),
  'start creates a one-question attempt');
SELECT ok((SELECT payload ? 'server_now' FROM first_start), 'start includes the authoritative server clock');
SELECT ok(NOT (SELECT payload::TEXT LIKE '%is_correct%' FROM first_start), 'start payload leaks no correctness metadata');
SELECT is((SELECT public.start_exam('00000000-0000-0000-0000-000000000341')->>'attempt_id'),
  (SELECT payload->>'attempt_id' FROM first_start), 'same start request is idempotent');

RESET ROLE;
SELECT is((SELECT COUNT(*) FROM public.exam WHERE student_id = '00000000-0000-0000-0000-000000000301'), 1::BIGINT,
  'idempotent start creates one attempt');
SELECT ok((SELECT COUNT(*) FROM public.exam_question WHERE exam_id = (SELECT (payload->>'attempt_id')::UUID FROM first_start)) = 1
  AND (SELECT COUNT(*) FROM public.exam_question_option) = 3, 'fixture snapshots one question and three options');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', TRUE);
CREATE TEMP TABLE first_question AS
  SELECT (payload->'questions'->0->>'exam_question_id')::UUID AS id,
         (payload->'questions'->0->'options'->0->>'id')::UUID AS correct_option
  FROM first_start;
CREATE TEMP TABLE saved_answer AS
  SELECT public.save_exam_answer((SELECT (payload->>'attempt_id')::UUID FROM first_start), id, correct_option) AS payload
  FROM first_question;
SELECT is((SELECT payload->>'status' FROM saved_answer), 'in_progress', 'save answer keeps attempt in progress');
SELECT ok(NOT (SELECT payload::TEXT LIKE '%is_correct%' FROM saved_answer), 'save payload leaks no correctness metadata');
SELECT ok((SELECT payload ? 'server_now' FROM saved_answer), 'save includes the authoritative server clock');
CREATE TEMP TABLE resumed_attempt AS
  SELECT public.get_exam_attempt((SELECT (payload->>'attempt_id')::UUID FROM first_start)) AS payload;
SELECT is((SELECT payload->>'status' FROM resumed_attempt), 'in_progress', 'get resumes the active attempt');
SELECT ok(NOT (SELECT payload::TEXT LIKE '%is_correct%' FROM resumed_attempt), 'resume payload leaks no correctness metadata');
SELECT ok((SELECT payload ? 'server_now' FROM resumed_attempt), 'resume includes the authoritative server clock');
CREATE TEMP TABLE manual_submit AS
  SELECT public.submit_exam((SELECT (payload->>'attempt_id')::UUID FROM first_start)) AS payload;
SELECT is((SELECT payload->>'status' FROM manual_submit), 'completed', 'manual submit finalizes the attempt');
SELECT is((SELECT public.submit_exam((SELECT (payload->>'attempt_id')::UUID FROM first_start))),
  (SELECT payload FROM manual_submit), 'repeated manual submit is idempotent');
SELECT ok(NOT (SELECT payload::TEXT LIKE '%is_correct%' FROM manual_submit), 'submit payload leaks no correctness metadata');
SELECT ok((SELECT payload ? 'server_now' FROM manual_submit), 'submit includes the authoritative server clock');

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', TRUE);
CREATE TEMP TABLE expiry_start AS
  SELECT public.start_exam('00000000-0000-0000-0000-000000000342') AS payload;
RESET ROLE;
UPDATE public.exam
SET started_at = NOW() - INTERVAL '31 minutes', deadline_at = NOW() - INTERVAL '1 minute'
WHERE id = (SELECT (payload->>'attempt_id')::UUID FROM expiry_start);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', TRUE);
CREATE TEMP TABLE expired_attempt AS
  SELECT public.get_exam_attempt((SELECT (payload->>'attempt_id')::UUID FROM expiry_start)) AS payload;
SELECT is((SELECT payload->>'status' FROM expired_attempt), 'completed', 'expired deadline finalizes on resume');
SELECT ok(NOT (SELECT payload::TEXT LIKE '%is_correct%' FROM expired_attempt), 'expired resume leaks no correctness metadata');
SELECT is((SELECT public.save_exam_answer((SELECT (payload->>'attempt_id')::UUID FROM expiry_start), id, correct_option)->>'status' FROM first_question),
  'completed', 'save after expiry returns the stable completed result');
CREATE TEMP TABLE repeated_expired_submit AS
  SELECT public.submit_exam((SELECT (payload->>'attempt_id')::UUID FROM expiry_start)) AS payload;
SELECT is((SELECT payload->>'status' FROM repeated_expired_submit), 'completed', 'repeated submit after expiry is idempotent');
SELECT is((SELECT (payload->'result'->>'score')::INTEGER FROM repeated_expired_submit), 0, 'unanswered question scores zero');
SELECT is((SELECT payload->'result'->'level'->>'code' FROM repeated_expired_submit), 'A1', 'expired result uses level snapshot');
SELECT ok(NOT (SELECT payload::TEXT LIKE '%is_correct%' FROM repeated_expired_submit), 'expired submit leaks no correctness metadata');

RESET ROLE;
SELECT throws_ok($$ UPDATE public.exam SET score = 0 WHERE id = (SELECT (payload->>'attempt_id')::UUID FROM expiry_start) $$,
  '55000', 'Completed exams are immutable', 'completed attempts are immutable');
SELECT throws_ok($$ UPDATE public.exam_question SET question_text = 'changed' WHERE exam_id = (SELECT (payload->>'attempt_id')::UUID FROM expiry_start) $$,
  '55000', 'Exam snapshots are immutable', 'question snapshots are immutable');
SELECT throws_ok($$ UPDATE public.exam_question_option SET is_correct = FALSE WHERE exam_question_id IN (SELECT id FROM public.exam_question WHERE exam_id = (SELECT (payload->>'attempt_id')::UUID FROM expiry_start)) $$,
  '55000', 'Exam snapshots are immutable', 'option snapshots are immutable');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', TRUE);
SELECT throws_ok($$ SELECT public.get_exam_attempt((SELECT (payload->>'attempt_id')::UUID FROM expiry_start)) $$,
  'P0002', 'Exam attempt not found', 'students cannot access another student attempt');
RESET ROLE;
ROLLBACK;

SELECT is((SELECT questions_per_exam FROM public.exam_config), 30, 'rollback restores the 30-question configuration');
SELECT is((SELECT COUNT(*) FROM public.question WHERE id = '00000000-0000-0000-0000-000000000311'), 0::BIGINT,
  'rollback removes the fixture question');
SELECT is((SELECT COUNT(*) FROM public.student WHERE id IN ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000302')), 0::BIGINT,
  'rollback removes fixture users');
SELECT is((SELECT COUNT(*) FROM public.exam WHERE student_id IN ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000302')), 0::BIGINT,
  'rollback removes fixture attempts');
SELECT * FROM finish();
