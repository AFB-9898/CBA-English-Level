CREATE OR REPLACE FUNCTION public.start_exam(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student_id UUID := public.fn_assert_student();
  v_exam public.exam;
  v_config public.exam_config;
  v_snapshot_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_question_count INTEGER;
  v_exception public.exam_attempt_exception%ROWTYPE;
  v_uses_exception BOOLEAN := FALSE;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Start request id is required' USING ERRCODE = '22004'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('student-exam:' || v_student_id::TEXT, 0));

  SELECT * INTO v_exam FROM public.exam
  WHERE student_id = v_student_id AND start_request_id = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_exam.status = 'in_progress' AND v_now >= v_exam.deadline_at THEN
      PERFORM public.fn_finalize_exam(v_exam.id);
    END IF;
    RETURN public.fn_exam_attempt_payload(v_exam.id);
  END IF;

  SELECT * INTO v_exam FROM public.exam
  WHERE student_id = v_student_id AND status = 'in_progress' FOR UPDATE;
  IF FOUND THEN
    IF v_now < v_exam.deadline_at THEN
      RETURN public.fn_exam_attempt_payload(v_exam.id);
    END IF;
    PERFORM public.fn_finalize_exam(v_exam.id);
  END IF;

  IF EXISTS (SELECT 1 FROM public.exam WHERE student_id = v_student_id AND status = 'completed'
    AND public.fn_cba_business_date(completed_at) = public.fn_cba_business_date(v_now)) THEN
    SELECT * INTO v_exception FROM public.exam_attempt_exception
    WHERE student_id = v_student_id AND cba_business_date = public.fn_cba_business_date(v_now)
      AND state = 'pending' AND expires_at > v_now FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student already completed an exam on this CBA business day' USING ERRCODE = '23505'; END IF;
    v_uses_exception := TRUE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('exam-config', 0));
  SELECT * INTO v_config FROM public.exam_config WHERE singleton FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current exam configuration not found' USING ERRCODE = '23514'; END IF;
  LOCK TABLE public.question, public.question_option IN SHARE MODE;
  SELECT COUNT(*) INTO v_question_count FROM public.question q
  WHERE (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id) >= 2
    AND (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id AND qo.is_correct) = 1;
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
  WITH selected AS (
    SELECT q.id, q.text, q.category, row_number() OVER (ORDER BY random()) - 1 AS ordinal FROM public.question q
    WHERE (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id) >= 2
      AND (SELECT COUNT(*) FROM public.question_option qo WHERE qo.question_id = q.id AND qo.is_correct) = 1
    ORDER BY random() LIMIT v_config.questions_per_exam
  )
  INSERT INTO public.exam_question (exam_id, question_id, "order", question_text, question_category)
  SELECT v_exam.id, id, ordinal::INTEGER, text, category FROM selected;
  INSERT INTO public.exam_question_option (exam_question_id, source_option_id, option_text, "order", is_correct)
  SELECT eq.id, qo.id, qo.text, qo."order", qo.is_correct FROM public.exam_question eq
  JOIN public.question_option qo ON qo.question_id = eq.question_id WHERE eq.exam_id = v_exam.id;
  INSERT INTO public.exam_level_snapshot (exam_id, source_level_id, code, name, version, min_score, max_score)
  SELECT v_exam.id, l.id, l.code, l.name, l.version, l.min_score, l.max_score FROM public.level l WHERE l.is_active ORDER BY l.min_score;
  IF (SELECT COUNT(*) FROM public.exam_level_snapshot WHERE exam_id = v_exam.id) = 0 THEN RAISE EXCEPTION 'No active CEFR levels exist' USING ERRCODE = '23514'; END IF;
  RETURN public.fn_exam_attempt_payload(v_exam.id);
END;
$$;
