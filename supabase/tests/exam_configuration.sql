-- Permanent contract tests for migration 007. Run after `supabase db reset` with psql.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(14);
SET search_path = public, extensions;

DROP FUNCTION IF EXISTS public.test_exam_config_assert(BOOLEAN, TEXT);
CREATE FUNCTION public.test_exam_config_assert(p_condition BOOLEAN, p_message TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'exam configuration contract failed: %', p_message;
  END IF;
  RETURN TRUE;
END;
$$;

INSERT INTO public.admin (id, email, full_name)
VALUES ('00000000-0000-0000-0000-000000000003', 'exam-config-admin@test.local', 'Exam Config Admin')
ON CONFLICT (id) DO NOTHING;
DELETE FROM public.admin WHERE id = '00000000-0000-0000-0000-000000000004';
GRANT SELECT ON public.audit_log TO authenticated;

BEGIN;
RESET ROLE;

SELECT ok((SELECT COUNT(*) FROM public.exam_config) = 1
  AND (SELECT singleton FROM public.exam_config), 'exactly one current configuration exists');

DO $$
BEGIN
  BEGIN
    INSERT INTO public.exam_config (time_limit_minutes, questions_per_exam, passing_score)
    VALUES (45, 25, 60);
    RAISE EXCEPTION 'second configuration unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'second configuration unexpectedly succeeded' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.exam_config;
    RAISE EXCEPTION 'configuration deletion unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'configuration deletion unexpectedly succeeded' THEN RAISE; END IF;
  END;
END;
$$;
SELECT ok(TRUE, 'database rejects a second current configuration and deletion of the current row');

SELECT ok((SELECT question_selection_rule FROM public.exam_config) = 'random_all_questions',
  'configuration explicitly models random selection from all questions');
SELECT ok(to_regprocedure('public.update_exam_config(bigint,integer,integer,integer)') IS NOT NULL,
  'revisioned update RPC is present');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', TRUE);
DO $$
BEGIN
  BEGIN
    UPDATE public.exam_config SET time_limit_minutes = 1;
    RAISE EXCEPTION 'direct client update unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'direct client update unexpectedly succeeded' THEN RAISE; END IF;
  END;
END;
$$;
SELECT ok(TRUE, 'an administrator cannot update the configuration directly');

SELECT public.update_exam_config(1, 45, 25, 60);
SELECT ok((SELECT revision FROM public.exam_config) = 2
  AND (SELECT time_limit_minutes FROM public.exam_config) = 45
  AND (SELECT questions_per_exam FROM public.exam_config) = 25
  AND (SELECT passing_score FROM public.exam_config) = 60,
  'admin RPC validates and applies one complete revision');
SELECT ok(public.fn_calculate_level(50) = (SELECT id FROM public.level WHERE code = 'B1' AND is_active),
  'passing score does not change CEFR level assignment');
SELECT ok((SELECT admin_id FROM public.audit_log WHERE entity = 'exam_config' AND action = 'update') = auth.uid()
  AND (SELECT details->'before'->>'revision' FROM public.audit_log WHERE entity = 'exam_config' AND action = 'update') = '1'
  AND (SELECT details->'after'->>'revision' FROM public.audit_log WHERE entity = 'exam_config' AND action = 'update') = '2',
  'successful update audits actor and before/after revisions');

DO $$
DECLARE v_revision BIGINT; v_audits INTEGER;
BEGIN
  SELECT revision INTO v_revision FROM public.exam_config;
  SELECT COUNT(*) INTO v_audits FROM public.audit_log WHERE entity = 'exam_config';
  BEGIN PERFORM public.update_exam_config(1, 30, 20, 50); EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
  PERFORM public.test_exam_config_assert((SELECT revision FROM public.exam_config) = v_revision, 'stale revision changes nothing');
  PERFORM public.test_exam_config_assert((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'exam_config') = v_audits, 'stale revision adds no audit row');
  BEGIN PERFORM public.update_exam_config(v_revision, 0, 20, 50); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM public.update_exam_config(v_revision, 30, 0, 50); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM public.update_exam_config(v_revision, 30, 20, -1); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM public.update_exam_config(v_revision, 30, 20, 101); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM public.test_exam_config_assert((SELECT revision FROM public.exam_config) = v_revision, 'invalid values change nothing');
  PERFORM public.test_exam_config_assert((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'exam_config') = v_audits, 'invalid values add no audit row');
END;
$$;
SELECT ok(TRUE, 'stale revisions and invalid time, count, and percentage values roll back atomically');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', TRUE);
DO $$
BEGIN
  BEGIN
    PERFORM public.update_exam_config(2, 30, 20, 50);
    RAISE EXCEPTION 'non-admin RPC unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  WHEN OTHERS THEN
    IF SQLERRM = 'non-admin RPC unexpectedly succeeded' THEN RAISE; END IF;
  END;
END;
$$;
SELECT ok(TRUE, 'non-administrator authentication is rejected');

RESET ROLE;
INSERT INTO public.exam_config_snapshot (
  source_config_id, source_revision, time_limit_minutes, questions_per_exam, passing_score, question_selection_rule
)
SELECT id, revision, time_limit_minutes, questions_per_exam, passing_score, question_selection_rule
FROM public.exam_config;
SELECT ok((SELECT source_revision FROM public.exam_config_snapshot) = 2
  AND (SELECT passing_score FROM public.exam_config_snapshot) = 60,
  'snapshot captures a specific configuration revision');

DO $$
BEGIN
  BEGIN UPDATE public.exam_config_snapshot SET passing_score = 0; RAISE EXCEPTION 'snapshot update unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'snapshot update unexpectedly succeeded' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.exam_config_snapshot; RAISE EXCEPTION 'snapshot deletion unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'snapshot deletion unexpectedly succeeded' THEN RAISE; END IF; END;
END;
$$;
SELECT ok(TRUE, 'configuration snapshots are immutable');
SELECT ok(EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'exam' AND column_name = 'config_snapshot_id' AND is_nullable = 'YES'
), 'future exams have an optional immutable configuration snapshot link');

ROLLBACK;
SELECT ok((SELECT revision FROM public.exam_config) = 1
  AND NOT EXISTS (SELECT 1 FROM public.exam_config_snapshot), 'test transaction cleanup is complete');
SELECT * FROM finish();
DROP FUNCTION public.test_exam_config_assert(BOOLEAN, TEXT);
