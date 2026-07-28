-- Administrative student management is RPC-only. Identity and exam records remain immutable.

CREATE INDEX IF NOT EXISTS idx_exam_admin_student_timeline ON public.exam (student_id, completed_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.fn_prevent_student_delete_with_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.exam WHERE student_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete a student with exam records' USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_delete_with_records ON public.student;
CREATE TRIGGER trg_prevent_student_delete_with_records
  BEFORE DELETE ON public.student
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_student_delete_with_records();

CREATE OR REPLACE FUNCTION public.get_admin_students(
  p_search TEXT DEFAULT NULL,
  p_cursor_full_name TEXT DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_page_size INTEGER DEFAULT 26
)
RETURNS TABLE (
  student_id UUID,
  full_name VARCHAR,
  ci VARCHAR,
  email VARCHAR,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_search TEXT := NULLIF(btrim(p_search), '');
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF (p_cursor_full_name IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'Student cursor must include full name and ID';
  END IF;
  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'Student page size must be between one and 100';
  END IF;

  RETURN QUERY
  SELECT s.id, s.full_name, s.ci, s.email, s.created_at
  FROM public.student s
  WHERE (
    v_search IS NULL
    OR position(lower(v_search) IN lower(s.full_name)) > 0
    OR position(lower(v_search) IN lower(s.ci)) > 0
    OR position(lower(v_search) IN lower(s.email)) > 0
  )
    AND (p_cursor_full_name IS NULL OR (s.full_name, s.id) > (p_cursor_full_name, p_cursor_id))
  ORDER BY s.full_name, s.id
  LIMIT p_page_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_student_detail(p_student_id UUID)
RETURNS TABLE (
  student_id UUID,
  full_name VARCHAR,
  ci VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id, s.full_name, s.ci, s.email, s.phone, s.created_at
  FROM public.student s
  WHERE s.id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_student_attempts(
  p_student_id UUID,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  attempt_id UUID,
  status public.exam_status,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score INTEGER,
  cefr_level_code VARCHAR,
  cefr_level_name VARCHAR,
  cefr_level_version INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'Student attempt page size must be between one and 100';
  END IF;

  RETURN QUERY
  SELECT e.id, e.status, e.started_at, e.completed_at, e.score,
         snapshot.code, snapshot.name, snapshot.version
  FROM public.exam e
  LEFT JOIN LATERAL (
    SELECT els.code, els.name, els.version
    FROM public.exam_level_snapshot els
    WHERE els.exam_id = e.id
      AND e.score BETWEEN els.min_score AND els.max_score
    ORDER BY els.min_score
    LIMIT 1
  ) snapshot ON TRUE
  WHERE e.student_id = p_student_id
  ORDER BY e.completed_at DESC NULLS LAST, e.id DESC
  LIMIT p_page_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_student_profile(
  p_student_id UUID,
  p_full_name VARCHAR,
  p_phone VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  student_id UUID,
  full_name VARCHAR,
  ci VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_full_name VARCHAR := btrim(p_full_name);
  v_phone VARCHAR := NULLIF(btrim(p_phone), '');
  v_student public.student%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF v_full_name IS NULL OR char_length(v_full_name) = 0 OR char_length(v_full_name) > 200 THEN
    RAISE EXCEPTION 'Student full name must contain between one and 200 characters' USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NOT NULL AND (char_length(v_phone) > 20 OR v_phone !~ '^[0-9]{7,15}$') THEN
    RAISE EXCEPTION 'Student phone must contain seven to 15 digits' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_student
  FROM public.student
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student profile no longer exists' USING ERRCODE = 'P0002';
  END IF;

  IF v_student.full_name IS DISTINCT FROM v_full_name
     OR v_student.phone IS DISTINCT FROM v_phone THEN
    INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
    VALUES (
      auth.uid(),
      'update',
      'student',
      v_student.id,
      jsonb_build_object(
        'before', jsonb_build_object('full_name', v_student.full_name, 'phone', v_student.phone),
        'after', jsonb_build_object('full_name', v_full_name, 'phone', v_phone)
      )
    );
  END IF;

  RETURN QUERY
  UPDATE public.student s
  SET full_name = v_full_name, phone = v_phone
  WHERE s.id = p_student_id
  RETURNING s.id, s.full_name, s.ci, s.email, s.phone, s.created_at;
END;
$$;

-- Column privileges make the allowed profile surface explicit even outside this module's RPC.
REVOKE UPDATE, DELETE ON TABLE public.student FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name, phone) ON TABLE public.student TO authenticated;

REVOKE ALL ON FUNCTION public.fn_prevent_student_delete_with_records(),
  public.get_admin_students(TEXT, TEXT, UUID, INTEGER),
  public.get_admin_student_detail(UUID),
  public.get_admin_student_attempts(UUID, INTEGER),
  public.update_admin_student_profile(UUID, VARCHAR, VARCHAR)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_students(TEXT, TEXT, UUID, INTEGER),
  public.get_admin_student_detail(UUID), public.get_admin_student_attempts(UUID, INTEGER),
  public.update_admin_student_profile(UUID, VARCHAR, VARCHAR)
  TO authenticated;
