-- A master administrator may grant one extra placement attempt for the current CBA day.
CREATE TABLE public.exam_attempt_exception (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.student(id) ON DELETE RESTRICT,
  cba_business_date DATE NOT NULL,
  reason VARCHAR(500) NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'consumed', 'revoked')),
  granted_by UUID NOT NULL REFERENCES public.admin(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_exam_id UUID REFERENCES public.exam(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.admin(id) ON DELETE RESTRICT,
  CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 10 AND 500),
  CHECK (expires_at > granted_at),
  CHECK (
    (state = 'pending' AND consumed_at IS NULL AND consumed_exam_id IS NULL AND revoked_at IS NULL AND revoked_by IS NULL)
    OR (state = 'consumed' AND consumed_at IS NOT NULL AND consumed_exam_id IS NOT NULL AND revoked_at IS NULL AND revoked_by IS NULL)
    OR (state = 'revoked' AND consumed_at IS NULL AND consumed_exam_id IS NULL AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  ),
  UNIQUE (student_id, cba_business_date)
);

CREATE INDEX idx_exam_attempt_exception_pending
  ON public.exam_attempt_exception (student_id, cba_business_date)
  WHERE state = 'pending';

CREATE OR REPLACE FUNCTION public.fn_guard_exam_attempt_exception_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Exam attempt exceptions are append-only' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NOT (
    OLD.state = 'pending' AND NEW.state IN ('consumed', 'revoked')
    AND NEW.student_id = OLD.student_id
    AND NEW.cba_business_date = OLD.cba_business_date
    AND NEW.reason = OLD.reason
    AND NEW.granted_by = OLD.granted_by
    AND NEW.granted_at = OLD.granted_at
    AND NEW.expires_at = OLD.expires_at
  ) THEN
    RAISE EXCEPTION 'Exam attempt exceptions may only be consumed or revoked once' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_guard_exam_attempt_exception_transition
  BEFORE UPDATE OR DELETE ON public.exam_attempt_exception
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_exam_attempt_exception_transition();

CREATE OR REPLACE FUNCTION public.get_exam_attempt_exception(p_student_id UUID)
RETURNS TABLE (
  exception_id UUID, cba_business_date DATE, reason VARCHAR, state TEXT,
  granted_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, consumed_at TIMESTAMPTZ,
  consumed_exam_id UUID, revoked_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.fn_require_capability('administrator_management');
  RETURN QUERY
  SELECT e.id, e.cba_business_date, e.reason,
         CASE WHEN e.state = 'pending' AND e.expires_at <= clock_timestamp() THEN 'expired' ELSE e.state END,
         e.granted_at, e.expires_at, e.consumed_at, e.consumed_exam_id, e.revoked_at
  FROM public.exam_attempt_exception e
  WHERE e.student_id = p_student_id
    AND e.cba_business_date = public.fn_cba_business_date(clock_timestamp());
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_exam_attempt_exception(p_student_id UUID, p_reason VARCHAR)
RETURNS TABLE (
  exception_id UUID, cba_business_date DATE, reason VARCHAR, state TEXT,
  granted_at TIMESTAMPTZ, expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor public.admin%ROWTYPE;
  v_exception public.exam_attempt_exception%ROWTYPE;
  v_reason VARCHAR(500) := btrim(p_reason);
  v_now TIMESTAMPTZ := clock_timestamp();
  v_date DATE := public.fn_cba_business_date(v_now);
  v_expires_at TIMESTAMPTZ := (v_date + 1)::TIMESTAMP AT TIME ZONE 'America/La_Paz';
BEGIN
  PERFORM public.fn_require_capability('administrator_management');
  IF p_student_id IS NULL OR v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Exception reason must contain between 10 and 500 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.student WHERE id = p_student_id) THEN
    RAISE EXCEPTION 'Student does not exist' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('exam-exception:' || p_student_id::TEXT || ':' || v_date::TEXT, 0));
  SELECT * INTO v_actor FROM public.admin WHERE id = auth.uid() AND is_active AND role = 'master_admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Master administrator access required' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.exam_attempt_exception (student_id, cba_business_date, reason, granted_by, granted_at, expires_at)
  VALUES (p_student_id, v_date, v_reason, v_actor.id, v_now, v_expires_at)
  RETURNING * INTO v_exception;
  INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
  VALUES (v_actor.id, 'grant', 'exam_attempt_exception', v_exception.id,
    jsonb_build_object('student_id', p_student_id, 'cba_business_date', v_date, 'reason', v_reason, 'expires_at', v_expires_at));
  RETURN QUERY SELECT v_exception.id, v_exception.cba_business_date, v_exception.reason, v_exception.state, v_exception.granted_at, v_exception.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_exam_attempt_exception(p_exception_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_actor public.admin%ROWTYPE; v_exception public.exam_attempt_exception%ROWTYPE;
BEGIN
  PERFORM public.fn_require_capability('administrator_management');
  SELECT * INTO v_actor FROM public.admin WHERE id = auth.uid() AND is_active AND role = 'master_admin';
  SELECT * INTO v_exception FROM public.exam_attempt_exception WHERE id = p_exception_id FOR UPDATE;
  IF NOT FOUND OR v_exception.state <> 'pending' OR v_exception.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'A valid pending exam attempt exception does not exist' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.exam_attempt_exception SET state = 'revoked', revoked_at = clock_timestamp(), revoked_by = v_actor.id WHERE id = v_exception.id;
  INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
  VALUES (v_actor.id, 'revoke', 'exam_attempt_exception', v_exception.id,
    jsonb_build_object('student_id', v_exception.student_id, 'cba_business_date', v_exception.cba_business_date));
END;
$$;

CREATE OR REPLACE FUNCTION public.start_exam(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student_id UUID := public.fn_assert_student(); v_exam public.exam; v_config public.exam_config;
  v_snapshot_id UUID; v_now TIMESTAMPTZ := NOW(); v_question_count INTEGER;
  v_exception public.exam_attempt_exception%ROWTYPE; v_uses_exception BOOLEAN := FALSE;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Start request id is required' USING ERRCODE = '22004'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('student-exam:' || v_student_id::TEXT, 0));
  SELECT * INTO v_exam FROM public.exam WHERE student_id = v_student_id AND start_request_id = p_request_id;
  IF FOUND THEN RETURN public.fn_exam_attempt_payload(v_exam.id); END IF;
  IF EXISTS (SELECT 1 FROM public.exam WHERE student_id = v_student_id AND status = 'completed' AND public.fn_cba_business_date(completed_at) = public.fn_cba_business_date(v_now)) THEN
    SELECT * INTO v_exception FROM public.exam_attempt_exception
    WHERE student_id = v_student_id AND cba_business_date = public.fn_cba_business_date(v_now)
      AND state = 'pending' AND expires_at > v_now FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student already completed an exam on this CBA business day' USING ERRCODE = '23505'; END IF;
    v_uses_exception := TRUE;
  END IF;
  SELECT * INTO v_exam FROM public.exam WHERE student_id = v_student_id AND status = 'in_progress' FOR UPDATE;
  IF FOUND THEN RETURN public.fn_exam_attempt_payload(v_exam.id); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('exam-config', 0));
  SELECT * INTO v_config FROM public.exam_config WHERE singleton FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current exam configuration not found' USING ERRCODE = '23514'; END IF;
  LOCK TABLE public.question, public.question_option IN SHARE MODE;
  SELECT COUNT(*) INTO v_question_count FROM public.question q WHERE (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id) >= 2 AND (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id AND qo.is_correct) = 1;
  IF v_question_count < v_config.questions_per_exam THEN RAISE EXCEPTION 'Not enough valid questions for the configured exam' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.exam_config_snapshot (source_config_id, source_revision, time_limit_minutes, questions_per_exam, passing_score, question_selection_rule)
  VALUES (v_config.id, v_config.revision, v_config.time_limit_minutes, v_config.questions_per_exam, v_config.passing_score, v_config.question_selection_rule)
  ON CONFLICT (source_config_id, source_revision) DO NOTHING RETURNING id INTO v_snapshot_id;
  IF v_snapshot_id IS NULL THEN SELECT id INTO v_snapshot_id FROM public.exam_config_snapshot WHERE source_config_id = v_config.id AND source_revision = v_config.revision; END IF;
  INSERT INTO public.exam (student_id, start_request_id, config_snapshot_id, started_at, deadline_at, status)
  VALUES (v_student_id, p_request_id, v_snapshot_id, v_now, v_now + make_interval(mins => v_config.time_limit_minutes), 'in_progress') RETURNING * INTO v_exam;
  IF v_uses_exception THEN
    UPDATE public.exam_attempt_exception SET state = 'consumed', consumed_at = clock_timestamp(), consumed_exam_id = v_exam.id WHERE id = v_exception.id;
    INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
    VALUES (v_exception.granted_by, 'consume', 'exam_attempt_exception', v_exception.id,
      jsonb_build_object('student_id', v_student_id, 'cba_business_date', v_exception.cba_business_date, 'exam_id', v_exam.id));
  END IF;
  WITH selected AS (SELECT q.id, q.text, q.category, row_number() OVER (ORDER BY random()) - 1 AS ordinal FROM public.question q WHERE (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id) >= 2 AND (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id AND qo.is_correct) = 1 ORDER BY random() LIMIT v_config.questions_per_exam)
  INSERT INTO public.exam_question (exam_id, question_id, "order", question_text, question_category) SELECT v_exam.id, id, ordinal::INTEGER, text, category FROM selected;
  INSERT INTO public.exam_question_option (exam_question_id, source_option_id, option_text, "order", is_correct) SELECT eq.id, qo.id, qo.text, qo."order", qo.is_correct FROM public.exam_question eq JOIN public.question_option qo ON qo.question_id = eq.question_id WHERE eq.exam_id = v_exam.id;
  INSERT INTO public.exam_level_snapshot (exam_id, source_level_id, code, name, version, min_score, max_score) SELECT v_exam.id, l.id, l.code, l.name, l.version, l.min_score, l.max_score FROM public.level l WHERE l.is_active ORDER BY l.min_score;
  IF (SELECT COUNT(*) FROM public.exam_level_snapshot WHERE exam_id = v_exam.id) = 0 THEN RAISE EXCEPTION 'No active CEFR levels exist' USING ERRCODE = '23514'; END IF;
  RETURN public.fn_exam_attempt_payload(v_exam.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_dashboard()
RETURNS TABLE (student_full_name VARCHAR, exam_state TEXT, latest_result_score INTEGER, latest_result_completed_at TIMESTAMPTZ, assigned_level_code VARCHAR, assigned_level_name VARCHAR, assigned_level_version INTEGER, attempt_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_student_id UUID := auth.uid();
BEGIN
  IF v_student_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.student WHERE id = v_student_id) THEN RAISE EXCEPTION 'Student access required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY WITH student_exams AS (SELECT e.id,e.status,e.completed_at,e.score,e.level_id FROM public.exam e WHERE e.student_id=v_student_id), latest_completed AS (SELECT e.score,e.completed_at,l.code,l.name,l.version FROM student_exams e LEFT JOIN public.level l ON l.id=e.level_id WHERE e.status='completed' ORDER BY e.completed_at DESC NULLS LAST,e.id DESC LIMIT 1)
  SELECT s.full_name, CASE WHEN EXISTS (SELECT 1 FROM student_exams WHERE status='in_progress') THEN 'in_progress' WHEN EXISTS (SELECT 1 FROM student_exams WHERE status='completed' AND public.fn_cba_business_date(completed_at)=public.fn_cba_business_date(NOW())) AND NOT EXISTS (SELECT 1 FROM public.exam_attempt_exception x WHERE x.student_id=v_student_id AND x.cba_business_date=public.fn_cba_business_date(NOW()) AND x.state='pending' AND x.expires_at>NOW()) THEN 'completed' ELSE 'available' END, latest_completed.score,latest_completed.completed_at,latest_completed.code,latest_completed.name,latest_completed.version,(SELECT COUNT(*) FROM student_exams) FROM public.student s LEFT JOIN latest_completed ON TRUE WHERE s.id=v_student_id;
END;
$$;

ALTER TABLE public.exam_attempt_exception ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.exam_attempt_exception FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_guard_exam_attempt_exception_transition(), public.get_exam_attempt_exception(UUID), public.grant_exam_attempt_exception(UUID, VARCHAR), public.revoke_exam_attempt_exception(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_attempt_exception(UUID), public.grant_exam_attempt_exception(UUID, VARCHAR), public.revoke_exam_attempt_exception(UUID) TO authenticated;
