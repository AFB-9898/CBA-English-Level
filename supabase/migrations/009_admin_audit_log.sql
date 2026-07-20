-- Secure administrative audit projection and prospective Question Bank auditing.

CREATE INDEX IF NOT EXISTS idx_audit_log_timeline
  ON public.audit_log (created_at DESC, id DESC);

-- Application roles may only consume the safe projection below.
DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_admin" ON public.audit_log
  FOR SELECT TO authenticated USING (public.fn_is_admin());
REVOKE ALL ON TABLE public.audit_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_audit_question_bank_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_action TEXT;
  v_entity_id UUID;
  v_details JSONB;
BEGIN
  v_action := CASE
    WHEN TG_OP = 'INSERT' THEN 'create'
    WHEN TG_OP = 'DELETE' THEN 'delete'
    WHEN TG_TABLE_NAME = 'question_option' AND (to_jsonb(NEW)->'is_correct') IS DISTINCT FROM (to_jsonb(OLD)->'is_correct') THEN 'answer_change'
    ELSE 'edit'
  END;
  v_entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  v_details := jsonb_build_object(
    'actor', auth.uid(),
    'before', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    'after', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );

  INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_entity_id, v_details);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_question_change ON public.question;
CREATE TRIGGER trg_audit_question_change
  AFTER INSERT OR UPDATE OR DELETE ON public.question
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_question_bank_change();

DROP TRIGGER IF EXISTS trg_audit_question_option_change ON public.question_option;
CREATE TRIGGER trg_audit_question_option_change
  AFTER INSERT OR UPDATE OR DELETE ON public.question_option
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_question_bank_change();

CREATE OR REPLACE FUNCTION public.fn_audit_summary(p_action TEXT, p_entity TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    WHEN p_entity = 'question_option' AND p_action = 'answer_change' THEN 'Changed correct answer'
    WHEN p_action = 'new_version' THEN 'Created new level version'
    WHEN p_action = 'deactivate' THEN 'Deactivated level'
    WHEN p_action = 'create' THEN 'Created ' || replace(p_entity, '_', ' ')
    WHEN p_action IN ('edit', 'update') THEN 'Updated ' || replace(p_entity, '_', ' ')
    WHEN p_action = 'delete' THEN 'Deleted ' || replace(p_entity, '_', ' ')
    ELSE 'Recorded administrative action'
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_audit_log(
  p_created_from DATE DEFAULT NULL,
  p_created_to DATE DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_entity TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_page_size INTEGER DEFAULT 25
)
RETURNS TABLE (
  audit_id UUID,
  created_at TIMESTAMPTZ,
  actor_id UUID,
  actor_display_name VARCHAR,
  action VARCHAR,
  entity VARCHAR,
  entity_id UUID,
  summary TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_created_from IS NOT NULL AND p_created_to IS NOT NULL AND p_created_from > p_created_to THEN
    RAISE EXCEPTION 'Audit date range is invalid';
  END IF;
  IF p_admin_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admin WHERE id = p_admin_id) THEN
    RAISE EXCEPTION 'Administrator does not exist';
  END IF;
  IF p_entity IS NOT NULL AND p_entity NOT IN ('level', 'exam_config', 'question', 'question_option') THEN
    RAISE EXCEPTION 'Audit entity filter is invalid';
  END IF;
  IF p_action IS NOT NULL AND p_action NOT IN ('create', 'edit', 'delete', 'deactivate', 'new_version', 'update', 'answer_change') THEN
    RAISE EXCEPTION 'Audit action filter is invalid';
  END IF;
  IF (p_cursor_created_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'Audit cursor must include timestamp and ID';
  END IF;
  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'Audit page size must be between one and 100';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.created_at,
    a.admin_id,
    actor.full_name,
    a.action,
    a.entity,
    a.entity_id,
    public.fn_audit_summary(a.action, a.entity)
  FROM public.audit_log a
  LEFT JOIN public.admin actor ON actor.id = a.admin_id
  WHERE (p_created_from IS NULL OR a.created_at::DATE >= p_created_from)
    AND (p_created_to IS NULL OR a.created_at::DATE <= p_created_to)
    AND (p_admin_id IS NULL OR a.admin_id = p_admin_id)
    AND (p_entity IS NULL OR a.entity = p_entity)
    AND (p_action IS NULL OR a.action = p_action)
    AND (p_cursor_created_at IS NULL OR (a.created_at, a.id) < (p_cursor_created_at, p_cursor_id))
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT p_page_size;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_audit_log(DATE, DATE, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log(DATE, DATE, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_audit_actors()
RETURNS TABLE (admin_id UUID, display_name VARCHAR)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id, a.full_name
  FROM public.admin a
  WHERE EXISTS (SELECT 1 FROM public.audit_log l WHERE l.admin_id = a.id)
  ORDER BY a.full_name, a.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_audit_actors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_actors() TO authenticated;
