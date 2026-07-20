-- Singleton, revisioned exam configuration with an admin-only update RPC.

ALTER TABLE public.exam_config
  ADD COLUMN singleton BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN question_selection_rule TEXT NOT NULL DEFAULT 'random_all_questions';

ALTER TABLE public.exam_config
  DROP CONSTRAINT IF EXISTS exam_config_time_limit_minutes_check,
  DROP CONSTRAINT IF EXISTS exam_config_questions_per_exam_check,
  DROP CONSTRAINT IF EXISTS exam_config_passing_score_check,
  ADD CONSTRAINT exam_config_singleton_true CHECK (singleton),
  ADD CONSTRAINT exam_config_time_limit_positive CHECK (time_limit_minutes > 0),
  ADD CONSTRAINT exam_config_question_count_positive CHECK (questions_per_exam > 0),
  ADD CONSTRAINT exam_config_passing_score_percentage CHECK (passing_score BETWEEN 0 AND 100),
  ADD CONSTRAINT exam_config_revision_positive CHECK (revision > 0),
  ADD CONSTRAINT exam_config_question_selection_rule CHECK (question_selection_rule = 'random_all_questions'),
  ADD CONSTRAINT exam_config_singleton_key UNIQUE (singleton);

-- A current configuration cannot disappear; its one row is seeded by migration 002.
CREATE OR REPLACE FUNCTION public.fn_prevent_exam_config_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'The current exam configuration cannot be deleted';
END;
$$;

CREATE TRIGGER trg_prevent_exam_config_delete
  BEFORE DELETE ON public.exam_config
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_exam_config_delete();

CREATE OR REPLACE FUNCTION public.fn_enforce_exam_config_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Exam configuration revision must increase by one';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_exam_config_revision
  BEFORE UPDATE ON public.exam_config
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_exam_config_revision();

-- Future exam creation will capture this immutable copy before linking it to an exam.
CREATE TABLE public.exam_config_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_config_id UUID NOT NULL REFERENCES public.exam_config(id) ON DELETE RESTRICT,
  source_revision BIGINT NOT NULL CHECK (source_revision > 0),
  time_limit_minutes INTEGER NOT NULL CHECK (time_limit_minutes > 0),
  questions_per_exam INTEGER NOT NULL CHECK (questions_per_exam > 0),
  passing_score INTEGER NOT NULL CHECK (passing_score BETWEEN 0 AND 100),
  question_selection_rule TEXT NOT NULL CHECK (question_selection_rule = 'random_all_questions'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_config_id, source_revision)
);

ALTER TABLE public.exam
  ADD COLUMN config_snapshot_id UUID REFERENCES public.exam_config_snapshot(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.fn_prevent_exam_config_snapshot_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Exam configuration snapshots are immutable';
END;
$$;

CREATE TRIGGER trg_prevent_exam_config_snapshot_change
  BEFORE UPDATE OR DELETE ON public.exam_config_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_exam_config_snapshot_change();

ALTER TABLE public.exam_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_config_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exam_config_update_admin" ON public.exam_config;
DROP POLICY IF EXISTS "exam_config_insert_admin" ON public.exam_config;
DROP POLICY IF EXISTS "exam_config_delete_admin" ON public.exam_config;

REVOKE ALL ON TABLE public.exam_config FROM anon, authenticated;
REVOKE ALL ON TABLE public.exam_config_snapshot FROM anon, authenticated;
GRANT SELECT ON TABLE public.exam_config TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_exam_config(
  p_expected_revision BIGINT,
  p_time_limit_minutes INTEGER,
  p_questions_per_exam INTEGER,
  p_passing_score INTEGER
)
RETURNS public.exam_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.exam_config;
  v_after public.exam_config;
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_time_limit_minutes IS NULL OR p_time_limit_minutes <= 0 THEN
    RAISE EXCEPTION 'Time limit must be greater than zero';
  END IF;
  IF p_questions_per_exam IS NULL OR p_questions_per_exam <= 0 THEN
    RAISE EXCEPTION 'Question count must be greater than zero';
  END IF;
  IF p_passing_score IS NULL OR p_passing_score < 0 OR p_passing_score > 100 THEN
    RAISE EXCEPTION 'Passing score must be a percentage from 0 through 100';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('exam-config', 0));
  SELECT * INTO v_before FROM public.exam_config WHERE singleton FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current exam configuration not found';
  END IF;
  IF p_expected_revision IS DISTINCT FROM v_before.revision THEN
    RAISE EXCEPTION 'Exam configuration revision is stale' USING ERRCODE = '40001';
  END IF;

  UPDATE public.exam_config
     SET time_limit_minutes = p_time_limit_minutes,
         questions_per_exam = p_questions_per_exam,
         passing_score = p_passing_score,
         revision = v_before.revision + 1
   WHERE id = v_before.id
   RETURNING * INTO v_after;

  INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(),
    'update',
    'exam_config',
    v_after.id,
    jsonb_build_object('actor', auth.uid(), 'before', to_jsonb(v_before), 'after', to_jsonb(v_after))
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.update_exam_config(BIGINT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_exam_config(BIGINT, INTEGER, INTEGER, INTEGER) TO authenticated;
