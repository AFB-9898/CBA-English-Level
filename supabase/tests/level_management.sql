-- Permanent contract tests for migration 006, including atomic deactivation.
-- Run after `supabase db reset`; the file is intentionally executed as psql.
-- The two-session stale-revision harness remains external: session A holds the
-- advisory lock and commits the only successful revision; session B receives 40001.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(21);
SET search_path = public, extensions;

DROP FUNCTION IF EXISTS public.test_level_assert(BOOLEAN, TEXT);
CREATE FUNCTION public.test_level_assert(p_condition BOOLEAN, p_message TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'level contract failed: %', p_message;
  END IF;
  RETURN TRUE;
END;
$$;

INSERT INTO public.admin (id, email, full_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'level-admin@test.local', 'Level Admin')
ON CONFLICT (id) DO NOTHING;
DELETE FROM public.admin WHERE id = '00000000-0000-0000-0000-000000000002';
TRUNCATE public.student_answer, public.exam_question_option, public.exam_level_snapshot, public.exam_question, public.question_option,
  public.exam, public.question, public.student, public.audit_log;
INSERT INTO public.student (id, ci, full_name, email)
VALUES ('00000000-0000-0000-0000-000000000010', 'TEST-LEVEL', 'Level Student', 'level@test.local');
BEGIN;
RESET ROLE;
GRANT SELECT ON public.level, public.admin, public.audit_log, public.level_partition_revision TO authenticated;
GRANT INSERT, SELECT ON public.question, public.exam TO authenticated;
INSERT INTO public.question (text, level_id, category)
SELECT 'Historical level fixture', id, 'atomic-level-test'
FROM public.level WHERE code = 'B1' AND version = 1;
INSERT INTO public.exam (student_id, level_id, status)
SELECT '00000000-0000-0000-0000-000000000010', id, 'pending'
FROM public.level WHERE code = 'B1' AND version = 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', TRUE);

SELECT ok((SELECT COUNT(*) FROM public.level WHERE is_active) = 5, 'catalog starts with five active levels');
SELECT ok(NOT EXISTS (
  SELECT score FROM generate_series(0, 100) AS score
  WHERE (SELECT COUNT(*) FROM public.level l WHERE l.is_active AND score BETWEEN l.min_score AND l.max_score) <> 1
), 'active catalog covers every score exactly once');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.level WHERE is_active AND (min_score < 0 OR max_score > 100 OR min_score > max_score)), 'ranges stay inside 0 through 100');
SELECT ok(public.fn_calculate_level(0) = (SELECT id FROM public.level WHERE code = 'A1' AND is_active)
  AND public.fn_calculate_level(100) = (SELECT id FROM public.level WHERE code = 'C1' AND is_active), 'classification is deterministic at boundaries');

-- Middle: B1 (41..60) is split evenly between its immediate neighbors.
SAVEPOINT middle_deactivation;
SELECT public.replace_active_level_distribution(1, (
  SELECT jsonb_agg(jsonb_build_object('id', id, 'min_score', CASE code WHEN 'B2' THEN 51 ELSE min_score END,
    'max_score', CASE code WHEN 'A2' THEN 50 ELSE max_score END) ORDER BY min_score)
  FROM public.level WHERE is_active AND code <> 'B1'
), (SELECT id FROM public.level WHERE code = 'B1' AND is_active));
SELECT ok((SELECT revision FROM public.level_partition_revision) = 2, 'middle deactivation advances revision');
SELECT ok((SELECT is_active FROM public.level WHERE code = 'B1' AND version = 1) = FALSE
  AND (SELECT COUNT(*) FROM public.level WHERE code = 'B1') = 1, 'target remains as one inactive historical row');
SELECT ok((SELECT max_score FROM public.level WHERE code = 'A2' AND is_active) = 50
  AND (SELECT min_score FROM public.level WHERE code = 'B2' AND is_active) = 51, 'middle range is redistributed to immediate neighbors');
SELECT ok((SELECT id FROM public.level WHERE code = 'A1' AND is_active) = (SELECT id FROM public.level WHERE code = 'A1' AND version = 1)
  AND (SELECT id FROM public.level WHERE code = 'C1' AND is_active) = (SELECT id FROM public.level WHERE code = 'C1' AND version = 1)
  AND (SELECT version FROM public.level WHERE code = 'A2' AND is_active) = 2
  AND (SELECT version FROM public.level WHERE code = 'B2' AND is_active) = 2, 'only changed neighbors are versioned');
SELECT ok((SELECT level_id FROM public.question WHERE category = 'atomic-level-test') = (SELECT id FROM public.level WHERE code = 'B1' AND version = 1)
  AND (SELECT level_id FROM public.exam WHERE student_id = '00000000-0000-0000-0000-000000000010') = (SELECT id FROM public.level WHERE code = 'B1' AND version = 1), 'question and exam history keeps its foreign keys');
SELECT ok((SELECT admin_id FROM public.audit_log WHERE action = 'deactivate' LIMIT 1) = auth.uid()
  AND (SELECT details->'before'->>'is_active' FROM public.audit_log WHERE action = 'deactivate' LIMIT 1) = 'true'
  AND (SELECT details->'after'->>'is_active' FROM public.audit_log WHERE action = 'deactivate' LIMIT 1) = 'false'
  AND (SELECT COUNT(*) FROM public.audit_log WHERE action = 'new_version') = 2, 'audit records actor and trusted before/after details');
ROLLBACK TO middle_deactivation;

-- Both boundaries: the sole neighbor absorbs the complete target interval.
SAVEPOINT lower_boundary;
SELECT public.replace_active_level_distribution(1, (
  SELECT jsonb_agg(jsonb_build_object('id', id, 'min_score', CASE code WHEN 'A2' THEN 0 ELSE min_score END,
    'max_score', CASE code WHEN 'A2' THEN 40 ELSE max_score END) ORDER BY min_score)
  FROM public.level WHERE is_active AND code <> 'A1'
), (SELECT id FROM public.level WHERE code = 'A1' AND is_active));
SELECT ok((SELECT min_score FROM public.level WHERE code = 'A2' AND is_active) = 0
  AND (SELECT max_score FROM public.level WHERE code = 'A2' AND is_active) = 40, 'lower boundary is absorbed by its upper neighbor');
ROLLBACK TO lower_boundary;

SAVEPOINT upper_boundary;
SELECT public.replace_active_level_distribution(1, (
  SELECT jsonb_agg(jsonb_build_object('id', id, 'min_score', CASE code WHEN 'B2' THEN 61 ELSE min_score END,
    'max_score', CASE code WHEN 'B2' THEN 100 ELSE max_score END) ORDER BY min_score)
  FROM public.level WHERE is_active AND code <> 'C1'
), (SELECT id FROM public.level WHERE code = 'C1' AND is_active));
SELECT ok((SELECT min_score FROM public.level WHERE code = 'B2' AND is_active) = 61
  AND (SELECT max_score FROM public.level WHERE code = 'B2' AND is_active) = 100, 'upper boundary is absorbed by its lower neighbor');
ROLLBACK TO upper_boundary;

-- Make B1 width 21, then deactivate it: the odd extra point goes upward.
SAVEPOINT odd_deactivation;
SELECT public.replace_active_level_distribution(1, (
  SELECT jsonb_agg(jsonb_build_object('id', id, 'min_score', CASE code WHEN 'B2' THEN 62 ELSE min_score END,
    'max_score', CASE code WHEN 'B1' THEN 61 ELSE max_score END) ORDER BY min_score)
  FROM public.level WHERE is_active)
);
SELECT public.replace_active_level_distribution(2, (
  SELECT jsonb_agg(jsonb_build_object('id', id, 'min_score', CASE code WHEN 'B2' THEN 51 ELSE min_score END,
    'max_score', CASE code WHEN 'A2' THEN 50 ELSE max_score END) ORDER BY min_score)
  FROM public.level WHERE is_active AND code <> 'B1'
), (SELECT id FROM public.level WHERE code = 'B1' AND is_active));
SELECT ok((SELECT max_score FROM public.level WHERE code = 'A2' AND is_active) = 50
  AND (SELECT min_score FROM public.level WHERE code = 'B2' AND is_active) = 51
  AND (SELECT max_score FROM public.level WHERE code = 'B2' AND is_active) = 80, 'odd target width gives the extra point to the upper neighbor');
SELECT ok((SELECT COUNT(*) FROM public.level WHERE is_active AND version > 1) = 2, 'odd deactivation versions only its two neighbors');
ROLLBACK TO odd_deactivation;

-- Invalid payload and stale revision both roll back rows, audit, and revision.
DO $$
DECLARE v_revision BIGINT; v_levels INTEGER; v_audit INTEGER; v_payload JSONB;
BEGIN
  SELECT revision INTO v_revision FROM public.level_partition_revision;
  SELECT COUNT(*) INTO v_levels FROM public.level;
  SELECT COUNT(*) INTO v_audit FROM public.audit_log;
  SELECT jsonb_agg(jsonb_build_object('id', id, 'min_score', CASE code WHEN 'A2' THEN 21 ELSE min_score END,
    'max_score', CASE code WHEN 'A2' THEN 49 WHEN 'B2' THEN max_score ELSE max_score END) ORDER BY min_score)
    INTO v_payload FROM public.level WHERE is_active AND code <> 'B1';
  BEGIN PERFORM public.replace_active_level_distribution(v_revision, v_payload, (SELECT id FROM public.level WHERE code = 'B1' AND is_active)); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM public.test_level_assert((SELECT revision FROM public.level_partition_revision) = v_revision, 'invalid deactivation keeps revision');
  PERFORM public.test_level_assert((SELECT COUNT(*) FROM public.level) = v_levels, 'invalid deactivation keeps rows');
  PERFORM public.test_level_assert((SELECT COUNT(*) FROM public.audit_log) = v_audit, 'invalid deactivation keeps audit unchanged');
  BEGIN PERFORM public.replace_active_level_distribution(v_revision - 1, v_payload, (SELECT id FROM public.level WHERE code = 'B1' AND is_active)); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM public.test_level_assert((SELECT revision FROM public.level_partition_revision) = v_revision, 'stale deactivation is rejected atomically');
END $$;
SELECT ok(TRUE, 'invalid and stale deactivation payloads fully roll back');

SELECT ok(to_regprocedure('public.create_level(character varying,character varying,integer,integer,text)') IS NULL
  AND to_regprocedure('public.replace_level_version(uuid,integer,integer,character varying,text)') IS NULL
  AND to_regprocedure('public.deactivate_level(uuid)') IS NULL, 'standalone range RPCs are removed');
SELECT ok((SELECT COUNT(*) FROM public.level_partition_revision) = 1, 'revision uses a singleton row');

DO $$
BEGIN
  BEGIN INSERT INTO public.level (code, name, min_score, max_score, description) VALUES ('DIRECT', 'Direct', 0, 0, NULL); RAISE EXCEPTION 'direct level write unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'direct level write unexpectedly succeeded' THEN RAISE; END IF; END;
END $$;
SELECT ok(TRUE, 'direct level writes are not an admin mutation path');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', TRUE);
DO $$
BEGIN
  BEGIN PERFORM public.replace_active_level_distribution(1, '[]'); RAISE EXCEPTION 'non-admin RPC unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'non-admin RPC unexpectedly succeeded' THEN RAISE; END IF; END;
END $$;
SELECT ok(TRUE, 'non-admin authentication is rejected');
SELECT ok((SELECT COUNT(*) FROM public.audit_log) = 0, 'non-admin cannot read audit history');

RESET ROLE;
ROLLBACK;
SELECT ok(NOT EXISTS (SELECT 1 FROM public.question WHERE category = 'atomic-level-test'), 'test transaction cleanup is complete');
SELECT * FROM finish();
DROP FUNCTION public.test_level_assert(BOOLEAN, TEXT);
