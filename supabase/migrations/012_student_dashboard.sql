-- Student-owned dashboard projection. The RPC deliberately exposes no exam content.

CREATE INDEX idx_exam_student_in_progress
  ON public.exam (student_id)
  WHERE status = 'in_progress';

CREATE INDEX idx_exam_student_completed_at
  ON public.exam (student_id, completed_at DESC, id DESC)
  WHERE status = 'completed';

CREATE OR REPLACE FUNCTION public.get_student_dashboard()
RETURNS TABLE (
  student_full_name VARCHAR,
  exam_state TEXT,
  latest_result_score INTEGER,
  latest_result_completed_at TIMESTAMPTZ,
  assigned_level_code VARCHAR,
  assigned_level_name VARCHAR,
  assigned_level_version INTEGER,
  attempt_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student_id UUID := auth.uid();
BEGIN
  IF v_student_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.student WHERE id = v_student_id
  ) THEN
    RAISE EXCEPTION 'Student access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH student_exams AS (
    SELECT e.id, e.status, e.completed_at, e.score, e.level_id
    FROM public.exam e
    WHERE e.student_id = v_student_id
  ), latest_completed AS (
    SELECT e.score, e.completed_at, l.code, l.name, l.version
    FROM student_exams e
    LEFT JOIN public.level l ON l.id = e.level_id
    WHERE e.status = 'completed'
    ORDER BY e.completed_at DESC NULLS LAST, e.id DESC
    LIMIT 1
  )
  SELECT
    s.full_name,
    CASE
      WHEN EXISTS (SELECT 1 FROM student_exams WHERE status = 'in_progress') THEN 'in_progress'
      WHEN EXISTS (SELECT 1 FROM student_exams WHERE status = 'completed' AND completed_at::DATE = CURRENT_DATE) THEN 'completed'
      ELSE 'available'
    END,
    latest_completed.score,
    latest_completed.completed_at,
    latest_completed.code,
    latest_completed.name,
    latest_completed.version,
    (SELECT COUNT(*) FROM student_exams)
  FROM public.student s
  LEFT JOIN latest_completed ON TRUE
  WHERE s.id = v_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_dashboard() TO authenticated;
