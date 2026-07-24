-- Student history is exposed only through safe, student-scoped RPC projections.

CREATE OR REPLACE FUNCTION public.get_student_exam_history()
RETURNS TABLE (
  attempt_id UUID,
  completed_at TIMESTAMPTZ,
  score INTEGER,
  cefr_level_code VARCHAR,
  cefr_level_name VARCHAR,
  cefr_level_version INTEGER,
  historical_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    e.id,
    e.completed_at,
    e.score,
    level_snapshot.code,
    level_snapshot.name,
    level_snapshot.version,
    'finalized'::TEXT
  FROM public.exam e
  LEFT JOIN LATERAL (
    SELECT els.code, els.name, els.version
    FROM public.exam_level_snapshot els
    WHERE els.exam_id = e.id
      AND e.score BETWEEN els.min_score AND els.max_score
    ORDER BY els.min_score
    LIMIT 1
  ) level_snapshot ON TRUE
  WHERE e.student_id = public.fn_assert_student()
    AND e.status = 'completed'
  ORDER BY e.completed_at DESC, e.id DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_student_exam_history_detail(p_attempt_id UUID)
RETURNS TABLE (
  completed_at TIMESTAMPTZ,
  score INTEGER,
  cefr_level_code VARCHAR,
  cefr_level_name VARCHAR,
  cefr_level_version INTEGER,
  historical_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    history.completed_at,
    history.score,
    history.cefr_level_code,
    history.cefr_level_name,
    history.cefr_level_version,
    history.historical_status
  FROM public.get_student_exam_history() history
  WHERE history.attempt_id = p_attempt_id;
$$;

REVOKE ALL ON FUNCTION public.get_student_exam_history(), public.get_student_exam_history_detail(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_exam_history(), public.get_student_exam_history_detail(UUID)
  TO authenticated;
