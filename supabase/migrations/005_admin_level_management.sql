-- Versioned CEFR levels with transactional administration, RLS, and audit.

ALTER TABLE public.level
  ADD COLUMN code VARCHAR(10),
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN supersedes_level_id UUID REFERENCES public.level(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX level_code_version_key ON public.level (code, version);
CREATE UNIQUE INDEX level_one_active_version_key ON public.level (code) WHERE is_active;
CREATE INDEX level_active_range_key ON public.level (min_score, max_score) WHERE is_active;

-- Preserve the five seeded UUIDs while converting the catalog to CEFR.
UPDATE public.level SET code = 'A1', name = 'A1', description = 'Breakthrough' WHERE min_score = 0;
UPDATE public.level SET code = 'A2', name = 'A2', description = 'Waystage' WHERE min_score = 21;
UPDATE public.level SET code = 'B1', name = 'B1', description = 'Threshold' WHERE min_score = 41;
UPDATE public.level SET code = 'B2', name = 'B2', description = 'Vantage' WHERE min_score = 61;
UPDATE public.level SET code = 'C1', name = 'C1', description = 'Effective Operational Proficiency' WHERE min_score = 81;

ALTER TABLE public.level
  ALTER COLUMN code SET NOT NULL,
  ADD CONSTRAINT level_code_required CHECK (btrim(code) <> ''),
  ADD CONSTRAINT level_version_positive CHECK (version >= 1),
  ADD CONSTRAINT level_score_range CHECK (min_score >= 0 AND max_score <= 100 AND min_score <= max_score);

CREATE OR REPLACE FUNCTION public.fn_validate_active_levels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_min INTEGER;
  v_max INTEGER;
  v_previous_max INTEGER;
BEGIN
  SELECT COUNT(*), MIN(min_score), MAX(max_score)
    INTO v_count, v_min, v_max
    FROM public.level WHERE is_active;
  IF v_count = 0 OR v_min <> 0 OR v_max <> 100 THEN
    RAISE EXCEPTION 'Active levels must cover scores 0 through 100';
  END IF;
  FOR v_min, v_max IN
    SELECT min_score, max_score FROM public.level WHERE is_active ORDER BY min_score
  LOOP
    IF v_min > v_max OR (v_previous_max IS NOT NULL AND v_min <> v_previous_max + 1) THEN
      RAISE EXCEPTION 'Active levels must be contiguous and non-overlapping';
    END IF;
    v_previous_max := v_max;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.admin WHERE id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.fn_audit_level_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT := current_setting('app.level_audit_action', TRUE);
  v_before JSONB := NULLIF(current_setting('app.level_audit_before', TRUE), '')::JSONB;
BEGIN
  IF v_action IS NOT NULL AND v_action <> ''
     AND current_setting('app.level_audit_skip', TRUE) IS DISTINCT FROM 'true' THEN
    INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
    VALUES (auth.uid(), v_action, 'level', NEW.id,
      jsonb_build_object('before', v_before, 'after', to_jsonb(NEW)));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_level_change
  AFTER INSERT OR UPDATE ON public.level
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_level_change();

DROP POLICY IF EXISTS "level_select_all" ON public.level;
DROP POLICY IF EXISTS "level_insert_admin" ON public.level;
DROP POLICY IF EXISTS "level_update_admin" ON public.level;
DROP POLICY IF EXISTS "level_delete_admin" ON public.level;
CREATE POLICY "level_select_active_or_admin" ON public.level
  FOR SELECT USING (is_active OR public.fn_is_admin());

DROP POLICY IF EXISTS "audit_log_insert_system" ON public.audit_log;

CREATE OR REPLACE FUNCTION public.create_level(
  p_code VARCHAR, p_name VARCHAR, p_min_score INTEGER, p_max_score INTEGER, p_description TEXT
)
RETURNS public.level
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_level public.level;
BEGIN
  IF NOT public.fn_is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('level-partition', 0));
  IF p_min_score < 0 OR p_max_score > 100 OR p_min_score > p_max_score THEN
    RAISE EXCEPTION 'Invalid score range';
  END IF;
  PERFORM set_config('app.level_audit_action', 'create', TRUE);
  INSERT INTO public.level (code, name, min_score, max_score, description)
    VALUES (p_code, p_name, p_min_score, p_max_score, p_description) RETURNING * INTO v_level;
  PERFORM public.fn_validate_active_levels();
  RETURN v_level;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_level_metadata(
  p_level_id UUID, p_name VARCHAR, p_description TEXT
)
RETURNS public.level
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_level public.level;
BEGIN
  IF NOT public.fn_is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('level-partition', 0));
  SELECT * INTO v_level FROM public.level WHERE id = p_level_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Level not found'; END IF;
  PERFORM set_config('app.level_audit_action', 'edit', TRUE);
  PERFORM set_config('app.level_audit_before', to_jsonb(v_level)::TEXT, TRUE);
  UPDATE public.level SET name = p_name, description = p_description WHERE id = p_level_id RETURNING * INTO v_level;
  RETURN v_level;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_level_version(
  p_level_id UUID, p_min_score INTEGER, p_max_score INTEGER,
  p_name VARCHAR, p_description TEXT
)
RETURNS public.level
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_old public.level; v_new public.level;
BEGIN
  IF NOT public.fn_is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('level-partition', 0));
  SELECT * INTO v_old FROM public.level WHERE id = p_level_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active level not found'; END IF;
  IF p_min_score < 0 OR p_max_score > 100 OR p_min_score > p_max_score THEN RAISE EXCEPTION 'Invalid score range'; END IF;
  PERFORM set_config('app.level_audit_action', 'new_version', TRUE);
  PERFORM set_config('app.level_audit_before', to_jsonb(v_old)::TEXT, TRUE);
  PERFORM set_config('app.level_audit_skip', 'true', TRUE);
  UPDATE public.level SET is_active = FALSE WHERE id = p_level_id;
  PERFORM set_config('app.level_audit_skip', 'false', TRUE);
  INSERT INTO public.level (code, name, min_score, max_score, description, version, supersedes_level_id)
    VALUES (v_old.code, p_name, p_min_score, p_max_score, p_description, v_old.version + 1, v_old.id)
    RETURNING * INTO v_new;
  PERFORM public.fn_validate_active_levels();
  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_level(p_level_id UUID)
RETURNS public.level
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_level public.level;
BEGIN
  IF NOT public.fn_is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('level-partition', 0));
  SELECT * INTO v_level FROM public.level WHERE id = p_level_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active level not found'; END IF;
  PERFORM set_config('app.level_audit_action', 'deactivate', TRUE);
  PERFORM set_config('app.level_audit_before', to_jsonb(v_level)::TEXT, TRUE);
  UPDATE public.level SET is_active = FALSE WHERE id = p_level_id RETURNING * INTO v_level;
  PERFORM public.fn_validate_active_levels();
  RETURN v_level;
END;
$$;

REVOKE ALL ON FUNCTION public.create_level(VARCHAR, VARCHAR, INTEGER, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_level_metadata(UUID, VARCHAR, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_level_version(UUID, INTEGER, INTEGER, VARCHAR, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_level(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_level(VARCHAR, VARCHAR, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_level_metadata(UUID, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_level_version(UUID, INTEGER, INTEGER, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_level(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_calculate_level(p_score INTEGER)
RETURNS UUID AS $$
  SELECT id FROM public.level WHERE is_active AND p_score BETWEEN min_score AND max_score ORDER BY min_score LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.fn_complete_exam(p_exam_id UUID)
RETURNS TABLE (score INTEGER, level_id UUID, level_name VARCHAR) AS $$
DECLARE v_score INTEGER; v_level_id UUID; v_level_name VARCHAR; v_total INTEGER; v_correct INTEGER;
BEGIN
  SELECT COUNT(*) FILTER (WHERE is_correct), COUNT(*) INTO v_correct, v_total FROM public.student_answer WHERE exam_id = p_exam_id;
  IF v_total = 0 THEN RAISE EXCEPTION 'An exam must have answers'; END IF;
  v_score := ROUND((v_correct::NUMERIC / v_total) * 100);
  SELECT l.id, l.name INTO v_level_id, v_level_name FROM public.level l
    WHERE l.is_active AND v_score BETWEEN l.min_score AND l.max_score ORDER BY l.min_score LIMIT 1;
  UPDATE public.exam SET score = v_score, level_id = v_level_id, completed_at = NOW(), status = 'completed' WHERE id = p_exam_id;
  RETURN QUERY SELECT v_score, v_level_id, v_level_name;
END;
$$ LANGUAGE plpgsql;

SELECT public.fn_validate_active_levels();
