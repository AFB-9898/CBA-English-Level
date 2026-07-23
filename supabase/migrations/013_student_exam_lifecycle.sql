-- Secure, reproducible student exam lifecycle. Student access is RPC-only.

-- The legacy trigger compares UTC/session dates and conflicts with the CBA day.
DROP TRIGGER IF EXISTS trg_check_daily_exam ON public.exam;
DROP FUNCTION IF EXISTS public.fn_check_daily_exam();

ALTER TABLE public.exam
  ADD COLUMN start_request_id UUID,
  ADD COLUMN deadline_at TIMESTAMPTZ;

ALTER TABLE public.exam_question
  ADD COLUMN question_text TEXT,
  ADD COLUMN question_category VARCHAR(100);

CREATE TABLE public.exam_question_option (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_question_id UUID NOT NULL REFERENCES public.exam_question(id) ON DELETE RESTRICT,
  source_option_id UUID NOT NULL REFERENCES public.question_option(id) ON DELETE RESTRICT,
  option_text TEXT NOT NULL CHECK (btrim(option_text) <> ''),
  "order" INTEGER NOT NULL CHECK ("order" >= 0),
  is_correct BOOLEAN NOT NULL,
  UNIQUE (exam_question_id, source_option_id),
  UNIQUE (exam_question_id, "order")
);

CREATE TABLE public.exam_level_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exam(id) ON DELETE RESTRICT,
  source_level_id UUID NOT NULL REFERENCES public.level(id) ON DELETE RESTRICT,
  code VARCHAR(10) NOT NULL CHECK (btrim(code) <> ''),
  name VARCHAR(100) NOT NULL CHECK (btrim(name) <> ''),
  version INTEGER NOT NULL CHECK (version >= 1),
  min_score INTEGER NOT NULL CHECK (min_score BETWEEN 0 AND 100),
  max_score INTEGER NOT NULL CHECK (max_score BETWEEN 0 AND 100 AND max_score >= min_score),
  UNIQUE (exam_id, source_level_id),
  UNIQUE (exam_id, min_score)
);

ALTER TABLE public.student_answer
  ADD COLUMN exam_question_id UUID REFERENCES public.exam_question(id) ON DELETE RESTRICT,
  ADD COLUMN selected_exam_question_option_id UUID REFERENCES public.exam_question_option(id) ON DELETE RESTRICT;

-- Do not silently change legacy attempts or question history to satisfy new uniqueness rules.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.exam
    WHERE status = 'in_progress'
    GROUP BY student_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add one-in-progress-attempt guarantee while legacy duplicate attempts exist'
      USING ERRCODE = '23505',
            DETAIL = 'Resolve duplicate in_progress attempts per student before applying migration 013.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.exam_question
    GROUP BY exam_id, "order"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique exam question ordering while legacy duplicate orders exist'
      USING ERRCODE = '23505',
            DETAIL = 'Resolve duplicate exam_question orders per attempt before applying migration 013.';
  END IF;
END;
$$;

ALTER TABLE public.exam
  ADD CONSTRAINT exam_start_request_id_key UNIQUE (student_id, start_request_id),
  ADD CONSTRAINT exam_snapshot_state_check CHECK (
    config_snapshot_id IS NULL
    OR (
      start_request_id IS NOT NULL
      AND started_at IS NOT NULL
      AND deadline_at > started_at
      AND (
        (status = 'in_progress' AND completed_at IS NULL AND score IS NULL AND level_id IS NULL)
        OR (status = 'completed' AND completed_at IS NOT NULL AND score BETWEEN 0 AND 100 AND level_id IS NOT NULL)
      )
    )
  ),
  ADD CONSTRAINT exam_completed_after_start_check CHECK (
    completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
  );

ALTER TABLE public.exam_question
  ADD CONSTRAINT exam_question_snapshot_check CHECK (
    question_text IS NULL OR btrim(question_text) <> ''
  ),
  ADD CONSTRAINT exam_question_snapshot_pair_check CHECK (
    (question_text IS NULL AND question_category IS NULL) OR question_text IS NOT NULL
  ),
  ADD CONSTRAINT exam_question_order_key UNIQUE (exam_id, "order");

ALTER TABLE public.student_answer
  ADD CONSTRAINT student_answer_snapshot_pair_check CHECK (
    (exam_question_id IS NULL AND selected_exam_question_option_id IS NULL)
    OR exam_question_id IS NOT NULL
  );

CREATE UNIQUE INDEX exam_one_in_progress_per_student_key
  ON public.exam (student_id)
  WHERE status = 'in_progress';

CREATE INDEX idx_exam_start_request_id ON public.exam (student_id, start_request_id);
CREATE INDEX idx_exam_question_option_exam_question ON public.exam_question_option (exam_question_id);
CREATE INDEX idx_exam_level_snapshot_exam ON public.exam_level_snapshot (exam_id, min_score);
CREATE INDEX idx_student_answer_exam_question ON public.student_answer (exam_id, exam_question_id);

CREATE OR REPLACE FUNCTION public.fn_cba_business_date(p_value TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$ SELECT (p_value AT TIME ZONE 'America/La_Paz')::DATE $$;

CREATE OR REPLACE FUNCTION public.fn_prevent_exam_snapshot_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Exam snapshots are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_prevent_exam_question_snapshot_change
  BEFORE UPDATE OR DELETE ON public.exam_question
  FOR EACH ROW WHEN (OLD.question_text IS NOT NULL)
  EXECUTE FUNCTION public.fn_prevent_exam_snapshot_change();

CREATE TRIGGER trg_prevent_exam_question_option_snapshot_change
  BEFORE UPDATE OR DELETE ON public.exam_question_option
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_exam_snapshot_change();

CREATE TRIGGER trg_prevent_exam_level_snapshot_change
  BEFORE UPDATE OR DELETE ON public.exam_level_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_exam_snapshot_change();

CREATE OR REPLACE FUNCTION public.fn_prevent_completed_exam_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed exams are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_enforce_exam_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_minutes INTEGER;
BEGIN
  IF NEW.config_snapshot_id IS NOT NULL THEN
    SELECT time_limit_minutes INTO v_minutes
    FROM public.exam_config_snapshot WHERE id = NEW.config_snapshot_id;
    IF v_minutes IS NULL
       OR NEW.deadline_at <> NEW.started_at + make_interval(mins => v_minutes) THEN
      RAISE EXCEPTION 'Exam deadline must match its configuration snapshot' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_exam_lifecycle
  BEFORE INSERT OR UPDATE ON public.exam
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_exam_lifecycle();

CREATE TRIGGER trg_prevent_completed_exam_change
  BEFORE UPDATE OR DELETE ON public.exam
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_completed_exam_change();

CREATE OR REPLACE FUNCTION public.fn_prevent_completed_answer_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.exam WHERE id = OLD.exam_id AND status = 'completed') THEN
    RAISE EXCEPTION 'Completed exam answers are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_historical_change ON public.student_answer;
CREATE TRIGGER trg_prevent_completed_answer_change
  BEFORE UPDATE OR DELETE ON public.student_answer
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_completed_answer_change();

CREATE OR REPLACE FUNCTION public.fn_assert_student()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student_id UUID := auth.uid();
BEGIN
  IF v_student_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.student WHERE id = v_student_id) THEN
    RAISE EXCEPTION 'Student access required' USING ERRCODE = '42501';
  END IF;
  RETURN v_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finalize_exam(p_exam_id UUID)
RETURNS public.exam
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_exam public.exam;
  v_total INTEGER;
  v_correct INTEGER;
  v_score INTEGER;
  v_level public.exam_level_snapshot;
BEGIN
  SELECT * INTO v_exam FROM public.exam WHERE id = p_exam_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_exam.status = 'completed' THEN
    RETURN v_exam;
  END IF;
  IF v_exam.config_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'Exam attempt is missing its configuration snapshot' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE sao.is_correct)
    INTO v_total, v_correct
  FROM public.exam_question eq
  LEFT JOIN public.student_answer sa ON sa.exam_id = v_exam.id AND sa.exam_question_id = eq.id
  LEFT JOIN public.exam_question_option sao ON sao.id = sa.selected_exam_question_option_id
  WHERE eq.exam_id = v_exam.id;

  IF v_total <> (SELECT questions_per_exam FROM public.exam_config_snapshot WHERE id = v_exam.config_snapshot_id) THEN
    RAISE EXCEPTION 'Exam assignment snapshot is incomplete' USING ERRCODE = '23514';
  END IF;
  v_score := ROUND((v_correct::NUMERIC / NULLIF(v_total, 0)) * 100);

  SELECT * INTO v_level
  FROM public.exam_level_snapshot
  WHERE exam_id = v_exam.id AND v_score BETWEEN min_score AND max_score
  ORDER BY min_score
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam CEFR snapshot does not cover the calculated score' USING ERRCODE = '23514';
  END IF;

  UPDATE public.exam
     SET completed_at = NOW(), score = v_score, level_id = v_level.source_level_id, status = 'completed'
   WHERE id = v_exam.id
   RETURNING * INTO v_exam;
  RETURN v_exam;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_exam_attempt_payload(p_exam_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'attempt_id', e.id,
    'status', e.status,
    'started_at', e.started_at,
    'deadline_at', e.deadline_at,
    'server_now', NOW(),
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'exam_question_id', eq.id,
        'order', eq."order",
        'text', eq.question_text,
        'category', eq.question_category,
        'selected_option_id', sa.selected_exam_question_option_id,
        'options', (
          SELECT jsonb_agg(jsonb_build_object('id', eqo.id, 'text', eqo.option_text, 'order', eqo."order") ORDER BY eqo."order")
          FROM public.exam_question_option eqo WHERE eqo.exam_question_id = eq.id
        )
      ) ORDER BY eq."order")
      FROM public.exam_question eq
      LEFT JOIN public.student_answer sa ON sa.exam_id = e.id AND sa.exam_question_id = eq.id
      WHERE eq.exam_id = e.id
    ), '[]'::JSONB),
    'result', CASE WHEN e.status = 'completed' THEN jsonb_build_object(
      'score', e.score,
      'level', (SELECT jsonb_build_object('id', els.source_level_id, 'code', els.code, 'name', els.name, 'version', els.version)
                FROM public.exam_level_snapshot els WHERE els.exam_id = e.id AND e.score BETWEEN els.min_score AND els.max_score ORDER BY els.min_score LIMIT 1)
    ) ELSE NULL END
  )
  FROM public.exam e WHERE e.id = p_exam_id;
$$;

CREATE OR REPLACE FUNCTION public.start_exam(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student_id UUID := public.fn_assert_student();
  v_exam public.exam;
  v_config public.exam_config;
  v_snapshot_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_question_count INTEGER;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Start request id is required' USING ERRCODE = '22004';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('student-exam:' || v_student_id::TEXT, 0));

  SELECT * INTO v_exam FROM public.exam
  WHERE student_id = v_student_id AND start_request_id = p_request_id;
  IF FOUND THEN
    RETURN public.fn_exam_attempt_payload(v_exam.id);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.exam
    WHERE student_id = v_student_id AND status = 'completed'
      AND public.fn_cba_business_date(completed_at) = public.fn_cba_business_date(v_now)
  ) THEN
    RAISE EXCEPTION 'Student already completed an exam on this CBA business day' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO v_exam FROM public.exam
  WHERE student_id = v_student_id AND status = 'in_progress' FOR UPDATE;
  IF FOUND THEN
    RETURN public.fn_exam_attempt_payload(v_exam.id);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('exam-config', 0));
  SELECT * INTO v_config FROM public.exam_config WHERE singleton FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current exam configuration not found' USING ERRCODE = '23514';
  END IF;
  LOCK TABLE public.question, public.question_option IN SHARE MODE;

  SELECT COUNT(*) INTO v_question_count
  FROM public.question q
  WHERE (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id) >= 2
    AND (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id AND qo.is_correct) = 1;
  IF v_question_count < v_config.questions_per_exam THEN
    RAISE EXCEPTION 'Not enough valid questions for the configured exam' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.exam_config_snapshot (
    source_config_id, source_revision, time_limit_minutes, questions_per_exam, passing_score, question_selection_rule
  ) VALUES (
    v_config.id, v_config.revision, v_config.time_limit_minutes, v_config.questions_per_exam,
    v_config.passing_score, v_config.question_selection_rule
  ) ON CONFLICT (source_config_id, source_revision) DO NOTHING
  RETURNING id INTO v_snapshot_id;
  IF v_snapshot_id IS NULL THEN
    SELECT id INTO v_snapshot_id FROM public.exam_config_snapshot
    WHERE source_config_id = v_config.id AND source_revision = v_config.revision;
  END IF;

  INSERT INTO public.exam (student_id, start_request_id, config_snapshot_id, started_at, deadline_at, status)
  VALUES (v_student_id, p_request_id, v_snapshot_id, v_now,
          v_now + make_interval(mins => v_config.time_limit_minutes), 'in_progress')
  RETURNING * INTO v_exam;

  WITH selected AS (
    SELECT q.id, q.text, q.category, row_number() OVER (ORDER BY random()) - 1 AS ordinal
    FROM public.question q
    WHERE (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id) >= 2
      AND (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id AND qo.is_correct) = 1
    ORDER BY random() LIMIT v_config.questions_per_exam
  )
  INSERT INTO public.exam_question (exam_id, question_id, "order", question_text, question_category)
  SELECT v_exam.id, id, ordinal::INTEGER, text, category FROM selected;

  INSERT INTO public.exam_question_option (exam_question_id, source_option_id, option_text, "order", is_correct)
  SELECT eq.id, qo.id, qo.text, qo."order", qo.is_correct
  FROM public.exam_question eq
  JOIN public.question_option qo ON qo.question_id = eq.question_id
  WHERE eq.exam_id = v_exam.id;

  INSERT INTO public.exam_level_snapshot (exam_id, source_level_id, code, name, version, min_score, max_score)
  SELECT v_exam.id, l.id, l.code, l.name, l.version, l.min_score, l.max_score
  FROM public.level l WHERE l.is_active ORDER BY l.min_score;

  IF (SELECT COUNT(*) FROM public.exam_level_snapshot WHERE exam_id = v_exam.id) = 0 THEN
    RAISE EXCEPTION 'No active CEFR levels exist' USING ERRCODE = '23514';
  END IF;
  RETURN public.fn_exam_attempt_payload(v_exam.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_exam_attempt(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student_id UUID := public.fn_assert_student();
  v_exam public.exam;
BEGIN
  SELECT * INTO v_exam FROM public.exam WHERE id = p_attempt_id AND student_id = v_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002'; END IF;
  IF v_exam.status = 'in_progress' AND NOW() >= v_exam.deadline_at THEN
    PERFORM public.fn_finalize_exam(v_exam.id);
  END IF;
  RETURN public.fn_exam_attempt_payload(v_exam.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_exam_answer(
  p_attempt_id UUID, p_exam_question_id UUID, p_option_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student_id UUID := public.fn_assert_student();
  v_exam public.exam;
  v_option public.exam_question_option;
BEGIN
  SELECT * INTO v_exam FROM public.exam WHERE id = p_attempt_id AND student_id = v_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002'; END IF;
  IF v_exam.status = 'in_progress' AND NOW() >= v_exam.deadline_at THEN
    PERFORM public.fn_finalize_exam(v_exam.id);
    RETURN public.fn_exam_attempt_payload(v_exam.id);
  END IF;
  IF v_exam.status <> 'in_progress' THEN
    RETURN public.fn_exam_attempt_payload(v_exam.id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.exam_question WHERE id = p_exam_question_id AND exam_id = v_exam.id) THEN
    RAISE EXCEPTION 'Question is not assigned to this exam attempt' USING ERRCODE = '23514';
  END IF;
  IF p_option_id IS NOT NULL THEN
    SELECT * INTO v_option FROM public.exam_question_option
    WHERE id = p_option_id AND exam_question_id = p_exam_question_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Option does not belong to the assigned question' USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO public.student_answer (
    exam_id, question_id, exam_question_id, selected_exam_question_option_id, selected_option_id, is_correct, answered_at
  )
  SELECT v_exam.id, eq.question_id, eq.id, p_option_id, v_option.source_option_id,
         CASE WHEN p_option_id IS NULL THEN NULL ELSE v_option.is_correct END, NOW()
  FROM public.exam_question eq WHERE eq.id = p_exam_question_id
  ON CONFLICT (exam_id, question_id) DO UPDATE SET
    exam_question_id = EXCLUDED.exam_question_id,
    selected_exam_question_option_id = EXCLUDED.selected_exam_question_option_id,
    selected_option_id = EXCLUDED.selected_option_id,
    is_correct = EXCLUDED.is_correct,
    answered_at = EXCLUDED.answered_at;

  RETURN public.fn_exam_attempt_payload(v_exam.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_exam(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student_id UUID := public.fn_assert_student();
  v_exam public.exam;
BEGIN
  SELECT * INTO v_exam FROM public.exam WHERE id = p_attempt_id AND student_id = v_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002'; END IF;
  IF v_exam.status = 'in_progress' THEN
    PERFORM public.fn_finalize_exam(v_exam.id);
  END IF;
  RETURN public.fn_exam_attempt_payload(v_exam.id);
END;
$$;

-- Student data access is limited to the four RPCs. Administrators retain Question Bank access.
DROP POLICY IF EXISTS "question_select_all" ON public.question;
DROP POLICY IF EXISTS "question_option_select_all" ON public.question_option;
CREATE POLICY "question_select_admin" ON public.question FOR SELECT TO authenticated USING (public.fn_is_admin());
CREATE POLICY "question_option_select_admin" ON public.question_option FOR SELECT TO authenticated USING (public.fn_is_admin());

DROP POLICY IF EXISTS "exam_select_own" ON public.exam;
DROP POLICY IF EXISTS "exam_select_admin" ON public.exam;
DROP POLICY IF EXISTS "exam_insert_student" ON public.exam;
DROP POLICY IF EXISTS "exam_update_own" ON public.exam;
DROP POLICY IF EXISTS "exam_question_select_own" ON public.exam_question;
DROP POLICY IF EXISTS "exam_question_insert_system" ON public.exam_question;
DROP POLICY IF EXISTS "student_answer_select_own" ON public.student_answer;
DROP POLICY IF EXISTS "student_answer_insert_own" ON public.student_answer;
DROP POLICY IF EXISTS "student_answer_update_own" ON public.student_answer;
CREATE POLICY "exam_select_admin" ON public.exam FOR SELECT TO authenticated USING (public.fn_is_admin());

ALTER TABLE public.exam_question_option ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_level_snapshot ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.exam, public.exam_question, public.student_answer,
  public.exam_question_option, public.exam_level_snapshot FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.question, public.question_option FROM anon;
GRANT SELECT ON TABLE public.audit_log TO authenticated;

REVOKE ALL ON FUNCTION public.fn_cba_business_date(TIMESTAMPTZ), public.fn_assert_student(),
  public.fn_finalize_exam(UUID), public.fn_exam_attempt_payload(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_complete_exam(UUID), public.fn_get_random_questions(INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_exam(UUID), public.get_exam_attempt(UUID),
  public.save_exam_answer(UUID, UUID, UUID), public.submit_exam(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_exam(UUID), public.get_exam_attempt(UUID),
  public.save_exam_answer(UUID, UUID, UUID), public.submit_exam(UUID) TO authenticated;
