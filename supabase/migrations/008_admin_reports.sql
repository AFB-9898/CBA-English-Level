-- Admin-only, read-only report access with historical level assignments.

CREATE INDEX idx_exam_report_completed_at ON public.exam (completed_at DESC, id DESC);
CREATE INDEX idx_exam_report_level_status ON public.exam (level_id, status);

CREATE OR REPLACE FUNCTION public.get_admin_exam_report(
  p_completed_from DATE DEFAULT NULL,
  p_completed_to DATE DEFAULT NULL,
  p_level_id UUID DEFAULT NULL,
  p_status public.exam_status DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25
)
RETURNS TABLE (
  exam_id UUID,
  student_id UUID,
  level_id UUID,
  completed_at TIMESTAMPTZ,
  student_full_name VARCHAR,
  student_ci VARCHAR,
  status public.exam_status,
  score INTEGER,
  level_code VARCHAR
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_page IS NULL OR p_page < 1 THEN
    RAISE EXCEPTION 'Page must be at least one';
  END IF;
  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 5000 THEN
    RAISE EXCEPTION 'Page size must be between one and 5000';
  END IF;
  IF p_completed_from IS NOT NULL AND p_completed_to IS NOT NULL AND p_completed_from > p_completed_to THEN
    RAISE EXCEPTION 'Completed date range is invalid';
  END IF;
  IF p_level_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.level WHERE id = p_level_id) THEN
    RAISE EXCEPTION 'Assigned level does not exist';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    s.id,
    e.level_id,
    e.completed_at,
    s.full_name,
    s.ci,
    e.status,
    e.score,
    l.code
  FROM public.exam e
  JOIN public.student s ON s.id = e.student_id
  LEFT JOIN public.level l ON l.id = e.level_id
  WHERE (p_completed_from IS NULL OR e.completed_at::DATE >= p_completed_from)
    AND (p_completed_to IS NULL OR e.completed_at::DATE <= p_completed_to)
    AND (p_level_id IS NULL OR e.level_id = p_level_id)
    AND (p_status IS NULL OR e.status = p_status)
  ORDER BY e.completed_at DESC NULLS LAST, e.id DESC
  OFFSET (p_page - 1) * p_page_size
  LIMIT p_page_size;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_exam_report(DATE, DATE, UUID, public.exam_status, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_exam_report(DATE, DATE, UUID, public.exam_status, INTEGER, INTEGER) TO authenticated;
