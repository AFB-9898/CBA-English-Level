-- Contract tests for migration 013. Run after `supabase db reset --local`.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(29);
SET search_path = public, extensions;

BEGIN;
RESET ROLE;
TRUNCATE public.student_answer, public.exam_question_option, public.exam_level_snapshot,
  public.exam_question, public.exam, public.question_option, public.question, public.student,
  public.exam_config_snapshot, public.audit_log RESTART IDENTITY CASCADE;

INSERT INTO public.student (id, ci, full_name, email) VALUES
  ('00000000-0000-0000-0000-000000000301', 'LIFE-301', 'Lifecycle Student', 'lifecycle-301@test.local'),
  ('00000000-0000-0000-0000-000000000302', 'LIFE-302', 'Other Student', 'lifecycle-302@test.local');

INSERT INTO public.question (id, text, level_id, category) VALUES
  ('00000000-0000-0000-0000-000000000311', 'Snapshot question one', (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1), 'contract'),
  ('00000000-0000-0000-0000-000000000312', 'Snapshot question two', (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1), 'contract');
INSERT INTO public.question_option (id, question_id, text, is_correct, "order") VALUES
  ('00000000-0000-0000-0000-000000000321', '00000000-0000-0000-0000-000000000311', 'Correct one', TRUE, 0),
  ('00000000-0000-0000-0000-000000000322', '00000000-0000-0000-0000-000000000311', 'Wrong one', FALSE, 1),
  ('00000000-0000-0000-0000-000000000323', '00000000-0000-0000-0000-000000000312', 'Correct two', TRUE, 0),
  ('00000000-0000-0000-0000-000000000324', '00000000-0000-0000-0000-000000000312', 'Wrong two', FALSE, 1);
UPDATE public.exam_config SET questions_per_exam = 2, time_limit_minutes = 30, passing_score = 50, revision = revision + 1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', TRUE);

SELECT ok(NOT has_table_privilege('authenticated', 'public.exam', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.exam', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.exam', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.exam', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.exam_question', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.student_answer', 'SELECT'),
  'authenticated students have no direct attempt, assignment, or answer privileges');
SELECT is((SELECT COUNT(*) FROM public.question), 0::BIGINT, 'student cannot read question bank rows');
SELECT is((SELECT COUNT(*) FROM public.question_option), 0::BIGINT, 'student cannot read question correctness');
SELECT ok(to_regprocedure('public.start_exam(uuid)') IS NOT NULL
  AND to_regprocedure('public.get_exam_attempt(uuid)') IS NOT NULL
  AND to_regprocedure('public.save_exam_answer(uuid,uuid,uuid)') IS NOT NULL
  AND to_regprocedure('public.submit_exam(uuid)') IS NOT NULL, 'authenticated lifecycle RPCs exist');
SELECT ok(NOT EXISTS (
  SELECT 1
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'exam' AND t.tgname = 'trg_check_daily_exam' AND NOT t.tgisinternal
), 'legacy UTC daily-exam trigger is removed');

CREATE TEMP TABLE lifecycle_result AS SELECT public.start_exam('00000000-0000-0000-0000-000000000341') AS payload;
SELECT ok((SELECT payload ? 'attempt_id' AND payload->'questions' IS NOT NULL FROM lifecycle_result), 'start returns an attempt and question payload');
SELECT ok((SELECT payload ? 'server_now' FROM lifecycle_result), 'start payload includes the authoritative server clock');
SELECT ok(NOT (SELECT payload::TEXT LIKE '%is_correct%' FROM lifecycle_result), 'start payload leaks no correctness metadata');
SELECT is((SELECT public.start_exam('00000000-0000-0000-0000-000000000341')->>'attempt_id' FROM lifecycle_result),
  (SELECT payload->>'attempt_id' FROM lifecycle_result), 'same request id is idempotent');
RESET ROLE;
SELECT is((SELECT COUNT(*) FROM public.exam WHERE student_id = '00000000-0000-0000-0000-000000000301'), 1::BIGINT, 'idempotent start creates one attempt');
SELECT ok((SELECT COUNT(*) FROM public.exam WHERE student_id = auth.uid() AND status = 'in_progress') = 1
  AND pg_get_functiondef('public.start_exam(uuid)'::regprocedure) LIKE '%pg_advisory_xact_lock%',
  'single in-progress constraint and transaction advisory lock protect concurrent starts');
SELECT ok((SELECT COUNT(*) FROM public.exam_config_snapshot) = 1
  AND (SELECT COUNT(*) FROM public.exam_question WHERE exam_id = (SELECT (payload->>'attempt_id')::UUID FROM lifecycle_result)) = 2
  AND (SELECT COUNT(*) FROM public.exam_question_option) = 4
  AND (SELECT COUNT(*) FROM public.exam_level_snapshot) = (SELECT COUNT(*) FROM public.level WHERE is_active),
  'config, question, option, and CEFR mappings are snapshotted at start');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', TRUE);
CREATE TEMP TABLE lifecycle_question AS
  SELECT (payload->'questions'->0->>'exam_question_id')::UUID AS id,
         (payload->'questions'->0->'options'->0->>'id')::UUID AS first_option,
         (payload->'questions'->0->'options'->1->>'id')::UUID AS second_option
  FROM lifecycle_result;
SELECT throws_ok($$ SELECT public.save_exam_answer((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID, (SELECT id FROM lifecycle_question), '00000000-0000-0000-0000-000000000324') $$,
  '23514', 'Option does not belong to the assigned question', 'save rejects an option from another assignment');
SELECT ok((SELECT public.save_exam_answer((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID, id, first_option)->>'status' = 'in_progress' FROM lifecycle_question),
  'save accepts an assigned option without returning correctness');
SELECT ok((SELECT public.save_exam_answer((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID, id, first_option) ? 'server_now' FROM lifecycle_question),
  'save payload includes the authoritative server clock');
RESET ROLE;
SELECT is((SELECT COUNT(*) FROM public.student_answer), 1::BIGINT, 'save upserts one answer');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', TRUE);
SELECT ok(NOT (SELECT public.get_exam_attempt((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID)::TEXT LIKE '%is_correct%'),
  'resume payload leaks no correctness metadata');
SELECT ok((SELECT public.get_exam_attempt((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID) ? 'server_now'),
  'resume payload includes the authoritative server clock');

RESET ROLE;
UPDATE public.exam
SET started_at = NOW() - INTERVAL '31 minutes', deadline_at = NOW() - INTERVAL '1 minute'
WHERE id = (SELECT (payload->>'attempt_id')::UUID FROM lifecycle_result);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', TRUE);
SELECT is((SELECT public.get_exam_attempt((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID)->>'status'), 'completed', 'resume finalizes an expired attempt');
SELECT is((SELECT public.save_exam_answer((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID, id, second_option)->>'status' FROM lifecycle_question), 'completed',
  'save after expiry returns the finalized stable result');
SELECT is((SELECT public.submit_exam((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID)->>'status'), 'completed', 'submit is idempotent after expiry');
SELECT ok((SELECT public.submit_exam((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID) ? 'server_now'),
  'submit payload includes the authoritative server clock');
SELECT is((SELECT (public.submit_exam((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID)->'result'->>'score')::INTEGER), 50,
  'scoring includes unanswered assigned questions as incorrect');
SELECT ok((SELECT public.submit_exam((SELECT payload->>'attempt_id' FROM lifecycle_result)::UUID)->'result'->'level'->>'code') = 'B1',
  'result uses the attempt CEFR snapshot');

RESET ROLE;
SELECT throws_ok($$ UPDATE public.exam SET score = 0 WHERE id = (SELECT (payload->>'attempt_id')::UUID FROM lifecycle_result) $$,
  '55000', 'Completed exams are immutable', 'completed attempts cannot be changed');
SELECT throws_ok($$ UPDATE public.exam_question SET question_text = 'changed' WHERE exam_id = (SELECT (payload->>'attempt_id')::UUID FROM lifecycle_result) $$,
  '55000', 'Exam snapshots are immutable', 'question snapshots cannot be changed');
SELECT throws_ok($$ UPDATE public.exam_question_option SET is_correct = FALSE $$,
  '55000', 'Exam snapshots are immutable', 'option correctness snapshots cannot be changed');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', TRUE);
SELECT throws_ok($$ SELECT public.get_exam_attempt((SELECT (payload->>'attempt_id')::UUID FROM lifecycle_result)) $$,
  'P0002', 'Exam attempt not found', 'students cannot access another student attempt');
RESET ROLE;
INSERT INTO public.exam (student_id, start_request_id, config_snapshot_id, started_at, deadline_at, completed_at, score, level_id, status)
SELECT '00000000-0000-0000-0000-000000000302', gen_random_uuid(), config_snapshot_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '90 minutes', NOW(), 50,
  (SELECT source_level_id FROM public.exam_level_snapshot WHERE exam_id = (SELECT (payload->>'attempt_id')::UUID FROM lifecycle_result) AND 50 BETWEEN min_score AND max_score), 'completed'
FROM public.exam WHERE id = (SELECT (payload->>'attempt_id')::UUID FROM lifecycle_result);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', TRUE);
SELECT throws_ok($$ SELECT public.start_exam('00000000-0000-0000-0000-000000000342') $$,
  '23505', 'Student already completed an exam on this CBA business day', 'CBA business-date rule blocks a second completed-today attempt');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
