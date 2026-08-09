-- Active administrator RBAC. Only master_admin and admin are active roles.

-- Administrator membership is granted only by a pending, database-owned
-- provisioning record. Auth metadata is never an authorization input.
CREATE TABLE public.administrator_provisioning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(200) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  secret_hash BYTEA NOT NULL CHECK (octet_length(secret_hash) = 32),
  requested_role TEXT NOT NULL CHECK (requested_role = 'admin'),
  requested_by UUID NOT NULL REFERENCES public.admin(id) ON DELETE RESTRICT,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'consumed', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_user_id UUID,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email = lower(btrim(email)) AND email <> ''),
  CHECK (full_name = btrim(full_name) AND full_name <> ''),
  CHECK (expires_at > created_at),
  CHECK (
    (state = 'consumed') = (consumed_at IS NOT NULL AND consumed_user_id IS NOT NULL)
    AND (state <> 'consumed' OR cancelled_at IS NULL)
    AND (state = 'cancelled') = (cancelled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX administrator_provisioning_one_pending_email
  ON public.administrator_provisioning (email) WHERE state = 'pending';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email VARCHAR(200) := lower(btrim(NEW.email));
  v_provisioning_secret TEXT := NEW.raw_user_meta_data ->> 'administrator_provisioning_secret';
  v_provisioning public.administrator_provisioning%ROWTYPE;
BEGIN
  UPDATE public.administrator_provisioning
  SET state = 'expired'
  WHERE email = v_email AND state = 'pending' AND expires_at <= clock_timestamp();

  UPDATE public.administrator_provisioning
  SET state = 'consumed', consumed_at = clock_timestamp(), consumed_user_id = NEW.id
  WHERE email = v_email
    AND state = 'pending'
    AND expires_at > clock_timestamp()
    AND secret_hash = extensions.digest(v_provisioning_secret, 'sha256')
  RETURNING * INTO v_provisioning;

  IF FOUND THEN
    INSERT INTO public.admin (id, email, full_name, role)
    VALUES (NEW.id, v_provisioning.email, v_provisioning.full_name, v_provisioning.requested_role);

    INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
    VALUES (
      v_provisioning.requested_by,
      'consume',
      'administrator_provisioning',
      v_provisioning.id,
      jsonb_build_object(
        'actor_id', v_provisioning.requested_by,
        'provisioning_id', v_provisioning.id,
        'email', v_provisioning.email,
        'requested_role', v_provisioning.requested_role,
        'consumed_user_id', NEW.id
      )
    );
  ELSE
    INSERT INTO public.student (id, ci, full_name, email, phone)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'ci',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.email,
      NEW.raw_user_meta_data ->> 'phone'
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.admin
  ADD COLUMN role TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT admin_role_check CHECK (role IN ('master_admin', 'admin'));

-- Existing installations receive one deterministic master before any policy is tightened.
WITH first_administrator AS (
  SELECT id FROM public.admin WHERE is_active ORDER BY created_at, id LIMIT 1
)
UPDATE public.admin SET role = 'master_admin'
WHERE id = (SELECT id FROM first_administrator);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin)
     AND NOT EXISTS (SELECT 1 FROM public.admin WHERE role = 'master_admin' AND is_active) THEN
    RAISE EXCEPTION 'RBAC migration requires at least one active master administrator';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_is_active_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin WHERE id = auth.uid() AND is_active)
$$;

CREATE OR REPLACE FUNCTION public.fn_has_capability(p_capability TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin
    WHERE id = auth.uid() AND is_active
      AND (
        role = 'master_admin'
        OR (role = 'admin' AND p_capability IN ('dashboard', 'students', 'questions', 'reports'))
      )
  )
$$;

-- Keep the legacy predicate safe for operational callers that have not yet been migrated.
CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT public.fn_is_active_admin()
$$;

CREATE OR REPLACE FUNCTION public.fn_prevent_invalid_master_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('active-master-admin', 0));
  IF TG_OP = 'UPDATE' AND OLD.id = auth.uid() AND OLD.is_active AND NOT NEW.is_active THEN
    RAISE EXCEPTION 'Administrators cannot deactivate themselves' USING ERRCODE = '42501';
  END IF;
  IF OLD.role = 'master_admin' AND OLD.is_active
     AND (TG_OP = 'DELETE' OR NEW.role <> 'master_admin' OR NOT NEW.is_active)
     AND NOT EXISTS (
       SELECT 1 FROM public.admin
       WHERE id <> OLD.id AND role = 'master_admin' AND is_active
     ) THEN
    RAISE EXCEPTION 'At least one active master administrator is required' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_invalid_master_change ON public.admin;
CREATE TRIGGER trg_prevent_invalid_master_change
  BEFORE UPDATE OR DELETE ON public.admin
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_invalid_master_change();

CREATE OR REPLACE FUNCTION public.fn_prevent_admin_audit_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Administrator audit records are append-only' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_audit_change ON public.audit_log;
CREATE TRIGGER trg_prevent_admin_audit_change
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_admin_audit_change();

CREATE OR REPLACE FUNCTION public.fn_guard_master_configuration()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  IF NOT public.fn_has_capability(TG_ARGV[0]) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_level_management ON public.level;
CREATE TRIGGER trg_guard_level_management BEFORE INSERT OR UPDATE OR DELETE ON public.level
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_master_configuration('levels');
DROP TRIGGER IF EXISTS trg_guard_exam_configuration ON public.exam_config;
CREATE TRIGGER trg_guard_exam_configuration BEFORE UPDATE ON public.exam_config
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_master_configuration('exam_configuration');

DROP POLICY IF EXISTS "admin_select_own" ON public.admin;
CREATE POLICY "admin_select_master" ON public.admin FOR SELECT TO authenticated
  USING (public.fn_has_capability('administrator_management'));
DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_master" ON public.audit_log FOR SELECT TO authenticated
  USING (public.fn_has_capability('audit'));
DROP POLICY IF EXISTS "level_select_active_or_admin" ON public.level;
CREATE POLICY "level_select_active_or_master" ON public.level FOR SELECT
  USING (is_active OR public.fn_has_capability('levels'));
DROP POLICY IF EXISTS "exam_config_select" ON public.exam_config;
CREATE POLICY "exam_config_select_master" ON public.exam_config FOR SELECT TO authenticated
  USING (public.fn_has_capability('exam_configuration'));

-- Replace the legacy membership-only Question Bank write policies so deactivated
-- administrators cannot retain direct CRUD access.
DROP POLICY IF EXISTS "question_insert_admin" ON public.question;
CREATE POLICY "question_insert_admin" ON public.question FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_capability('questions'));
DROP POLICY IF EXISTS "question_update_admin" ON public.question;
CREATE POLICY "question_update_admin" ON public.question FOR UPDATE TO authenticated
  USING (public.fn_has_capability('questions'))
  WITH CHECK (public.fn_has_capability('questions'));
DROP POLICY IF EXISTS "question_delete_admin" ON public.question;
CREATE POLICY "question_delete_admin" ON public.question FOR DELETE TO authenticated
  USING (public.fn_has_capability('questions'));

DROP POLICY IF EXISTS "question_option_insert_admin" ON public.question_option;
CREATE POLICY "question_option_insert_admin" ON public.question_option FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_capability('questions'));
DROP POLICY IF EXISTS "question_option_update_admin" ON public.question_option;
CREATE POLICY "question_option_update_admin" ON public.question_option FOR UPDATE TO authenticated
  USING (public.fn_has_capability('questions'))
  WITH CHECK (public.fn_has_capability('questions'));
DROP POLICY IF EXISTS "question_option_delete_admin" ON public.question_option;
CREATE POLICY "question_option_delete_admin" ON public.question_option FOR DELETE TO authenticated
  USING (public.fn_has_capability('questions'));

CREATE OR REPLACE FUNCTION public.get_current_principal()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_user_id UUID := auth.uid(); v_admin public.admin%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_admin FROM public.admin WHERE id = v_user_id;
  IF FOUND AND EXISTS (SELECT 1 FROM public.student WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Principal has conflicting memberships' USING ERRCODE = '23514';
  END IF;
  IF FOUND AND v_admin.is_active THEN
    RETURN jsonb_build_object('role', v_admin.role, 'admin_name', v_admin.full_name);
  END IF;
  IF EXISTS (SELECT 1 FROM public.student WHERE id = v_user_id) THEN RETURN jsonb_build_object('role', 'student'); END IF;
  RAISE EXCEPTION 'No active application principal exists for this user' USING ERRCODE = '42501';
END;
$$;

DROP FUNCTION IF EXISTS public.create_administrator(UUID, VARCHAR, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS public.create_administrator_provisioning(VARCHAR, VARCHAR, TEXT);

CREATE FUNCTION public.create_administrator_provisioning(p_email VARCHAR, p_full_name VARCHAR, p_role TEXT, p_secret TEXT)
RETURNS TABLE (id UUID, email VARCHAR, full_name VARCHAR, requested_role TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_actor public.admin%ROWTYPE;
  v_provisioning public.administrator_provisioning%ROWTYPE;
  v_email VARCHAR(200) := lower(btrim(p_email));
  v_full_name VARCHAR(200) := btrim(p_full_name);
BEGIN
  IF NOT public.fn_has_capability('administrator_management') THEN
    RAISE EXCEPTION 'Master administrator access required' USING ERRCODE = '42501';
  END IF;
  IF p_role <> 'admin' OR v_email = '' OR v_full_name = '' OR p_secret !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Administrator data is invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.administrator_provisioning AS provisioning
  SET state = 'expired'
  WHERE provisioning.email = v_email AND provisioning.state = 'pending' AND provisioning.expires_at <= clock_timestamp();

  IF EXISTS (SELECT 1 FROM public.administrator_provisioning AS provisioning WHERE provisioning.email = v_email AND provisioning.state = 'pending') THEN
    RAISE EXCEPTION 'An active administrator provisioning already exists for this email' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.student AS student WHERE student.email = v_email)
     OR EXISTS (SELECT 1 FROM public.admin AS administrator WHERE administrator.email = v_email) THEN
    RAISE EXCEPTION 'Email already belongs to an application principal' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_actor FROM public.admin AS administrator WHERE administrator.id = auth.uid();
  INSERT INTO public.administrator_provisioning (email, full_name, secret_hash, requested_role, requested_by, expires_at)
  VALUES (v_email, v_full_name, extensions.digest(p_secret, 'sha256'), p_role, v_actor.id, clock_timestamp() + interval '15 minutes')
  RETURNING * INTO v_provisioning;
  INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
  VALUES (
    v_actor.id,
    'create',
    'administrator_provisioning',
    v_provisioning.id,
    jsonb_build_object('actor_id', v_actor.id, 'email', v_provisioning.email, 'requested_role', v_provisioning.requested_role, 'expires_at', v_provisioning.expires_at)
  );
  RETURN QUERY SELECT v_provisioning.id, v_provisioning.email, v_provisioning.full_name, v_provisioning.requested_role, v_provisioning.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_administrator_provisioning(p_provisioning_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_actor public.admin%ROWTYPE;
  v_provisioning public.administrator_provisioning%ROWTYPE;
BEGIN
  IF NOT public.fn_has_capability('administrator_management') THEN
    RAISE EXCEPTION 'Master administrator access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_actor FROM public.admin AS administrator WHERE administrator.id = auth.uid();
  UPDATE public.administrator_provisioning AS provisioning
  SET state = 'cancelled', cancelled_at = clock_timestamp()
  WHERE provisioning.id = p_provisioning_id AND provisioning.state = 'pending' AND provisioning.requested_by = v_actor.id
  RETURNING * INTO v_provisioning;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending administrator provisioning does not exist' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
  VALUES (v_actor.id, 'cancel', 'administrator_provisioning', v_provisioning.id, jsonb_build_object('actor_id', v_actor.id, 'email', v_provisioning.email));
END;
$$;

-- A response can be lost or malformed after the provisioning insert commits.
-- The opaque single-use secret safely identifies only that caller's pending row.
CREATE OR REPLACE FUNCTION public.cancel_administrator_provisioning_by_secret(p_email VARCHAR, p_secret TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_actor public.admin%ROWTYPE;
  v_provisioning public.administrator_provisioning%ROWTYPE;
  v_email VARCHAR(200) := lower(btrim(p_email));
BEGIN
  IF NOT public.fn_has_capability('administrator_management') THEN
    RAISE EXCEPTION 'Master administrator access required' USING ERRCODE = '42501';
  END IF;
  IF v_email = '' OR p_secret !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Administrator provisioning cleanup is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_actor FROM public.admin AS administrator WHERE administrator.id = auth.uid();
  UPDATE public.administrator_provisioning AS provisioning
  SET state = 'cancelled', cancelled_at = clock_timestamp()
  WHERE provisioning.email = v_email
    AND provisioning.state = 'pending'
    AND provisioning.requested_by = v_actor.id
    AND provisioning.secret_hash = extensions.digest(p_secret, 'sha256')
  RETURNING * INTO v_provisioning;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
  VALUES (v_actor.id, 'cancel', 'administrator_provisioning', v_provisioning.id, jsonb_build_object('actor_id', v_actor.id, 'email', v_provisioning.email));
  RETURN TRUE;
END;
$$;

-- Recovery verifies the caller-owned opaque identity before the function can
-- retain a committed invite or compensate a pending one after an Auth timeout.
CREATE OR REPLACE FUNCTION public.get_administrator_provisioning_recovery(p_email VARCHAR, p_secret TEXT)
RETURNS TABLE (id UUID, state TEXT, consumed_user_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_actor public.admin%ROWTYPE;
  v_email VARCHAR(200) := lower(btrim(p_email));
BEGIN
  IF NOT public.fn_has_capability('administrator_management') THEN
    RAISE EXCEPTION 'Master administrator access required' USING ERRCODE = '42501';
  END IF;
  IF v_email = '' OR p_secret !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Administrator provisioning recovery is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_actor FROM public.admin AS administrator WHERE administrator.id = auth.uid();
  RETURN QUERY
  SELECT provisioning.id, provisioning.state, provisioning.consumed_user_id
  FROM public.administrator_provisioning AS provisioning
  WHERE provisioning.email = v_email
    AND provisioning.requested_by = v_actor.id
    AND provisioning.secret_hash = extensions.digest(p_secret, 'sha256')
    AND provisioning.state IN ('pending', 'consumed');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_administrator(p_admin_id UUID, p_full_name VARCHAR, p_role TEXT, p_is_active BOOLEAN)
RETURNS TABLE (id UUID, email VARCHAR, full_name VARCHAR, role TEXT, is_active BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_actor public.admin%ROWTYPE; v_before public.admin%ROWTYPE; v_after public.admin%ROWTYPE;
BEGIN
  IF NOT public.fn_has_capability('administrator_management') THEN RAISE EXCEPTION 'Master administrator access required' USING ERRCODE = '42501'; END IF;
  IF p_role NOT IN ('master_admin', 'admin') OR p_is_active IS NULL OR btrim(p_full_name) = '' THEN RAISE EXCEPTION 'Administrator data is invalid' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_actor FROM public.admin WHERE id = auth.uid();
  SELECT * INTO v_before FROM public.admin WHERE id = p_admin_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Administrator does not exist' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.admin SET full_name = btrim(p_full_name), role = p_role, is_active = p_is_active WHERE id = p_admin_id RETURNING * INTO v_after;
  IF to_jsonb(v_before) IS DISTINCT FROM to_jsonb(v_after) THEN
    INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details) VALUES
      (v_actor.id, 'update', 'administrator', v_after.id, jsonb_build_object('actor', jsonb_build_object('id', v_actor.id, 'role', v_actor.role), 'target', jsonb_build_object('before', jsonb_build_object('role', v_before.role, 'is_active', v_before.is_active), 'after', jsonb_build_object('role', v_after.role, 'is_active', v_after.is_active))));
  END IF;
  RETURN QUERY SELECT v_after.id, v_after.email, v_after.full_name, v_after.role, v_after.is_active;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_administrators()
RETURNS TABLE (id UUID, email VARCHAR, full_name VARCHAR, role TEXT, is_active BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  PERFORM public.fn_require_capability('administrator_management');
  RETURN QUERY SELECT a.id, a.email, a.full_name, a.role, a.is_active, a.created_at FROM public.admin a ORDER BY a.full_name, a.id;
END;
$$;

-- Restrict master-only operations while retaining operational access for active admins.
CREATE OR REPLACE FUNCTION public.fn_require_capability(p_capability TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN IF NOT public.fn_has_capability(p_capability) THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501'; END IF; END;
$$;

-- Existing SECURITY DEFINER routines use this capability gate after the role split.
CREATE OR REPLACE FUNCTION public.update_exam_config(p_expected_revision BIGINT, p_time_limit_minutes INTEGER, p_questions_per_exam INTEGER, p_passing_score INTEGER)
RETURNS public.exam_config LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_before public.exam_config; v_after public.exam_config;
BEGIN
  PERFORM public.fn_require_capability('exam_configuration');
  IF p_time_limit_minutes IS NULL OR p_time_limit_minutes <= 0 OR p_questions_per_exam IS NULL OR p_questions_per_exam <= 0 OR p_passing_score IS NULL OR p_passing_score NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Exam configuration is invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('exam-config', 0)); SELECT * INTO v_before FROM public.exam_config WHERE singleton FOR UPDATE;
  IF p_expected_revision IS DISTINCT FROM v_before.revision THEN RAISE EXCEPTION 'Exam configuration revision is stale' USING ERRCODE = '40001'; END IF;
  UPDATE public.exam_config SET time_limit_minutes=p_time_limit_minutes, questions_per_exam=p_questions_per_exam, passing_score=p_passing_score, revision=v_before.revision+1 WHERE id=v_before.id RETURNING * INTO v_after;
  INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details) VALUES (auth.uid(), 'update', 'exam_config', v_after.id, jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after)));
  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_audit_log(p_created_from DATE DEFAULT NULL, p_created_to DATE DEFAULT NULL, p_admin_id UUID DEFAULT NULL, p_entity TEXT DEFAULT NULL, p_action TEXT DEFAULT NULL, p_cursor_created_at TIMESTAMPTZ DEFAULT NULL, p_cursor_id UUID DEFAULT NULL, p_page_size INTEGER DEFAULT 25)
RETURNS TABLE (audit_id UUID, created_at TIMESTAMPTZ, actor_id UUID, actor_display_name VARCHAR, action VARCHAR, entity VARCHAR, entity_id UUID, summary TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  PERFORM public.fn_require_capability('audit');
  IF p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 100 OR (p_cursor_created_at IS NULL) <> (p_cursor_id IS NULL) THEN RAISE EXCEPTION 'Audit query is invalid'; END IF;
  RETURN QUERY SELECT a.id,a.created_at,a.admin_id,actor.full_name,a.action,a.entity,a.entity_id,public.fn_audit_summary(a.action,a.entity) FROM public.audit_log a LEFT JOIN public.admin actor ON actor.id=a.admin_id
  WHERE (p_created_from IS NULL OR a.created_at::DATE>=p_created_from) AND (p_created_to IS NULL OR a.created_at::DATE<=p_created_to) AND (p_admin_id IS NULL OR a.admin_id=p_admin_id) AND (p_entity IS NULL OR a.entity=p_entity) AND (p_action IS NULL OR a.action=p_action) AND (p_cursor_created_at IS NULL OR (a.created_at,a.id)<(p_cursor_created_at,p_cursor_id)) ORDER BY a.created_at DESC,a.id DESC LIMIT p_page_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_audit_actors() RETURNS TABLE (admin_id UUID, display_name VARCHAR)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT a.id,a.full_name FROM public.admin a WHERE public.fn_has_capability('audit') AND EXISTS (SELECT 1 FROM public.audit_log l WHERE l.admin_id=a.id) ORDER BY a.full_name,a.id
$$;

REVOKE ALL ON TABLE public.admin, public.administrator_provisioning FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_administrator_provisioning(VARCHAR, VARCHAR, TEXT, TEXT), public.cancel_administrator_provisioning(UUID), public.cancel_administrator_provisioning_by_secret(VARCHAR, TEXT), public.get_administrator_provisioning_recovery(VARCHAR, TEXT), public.update_administrator(UUID, VARCHAR, TEXT, BOOLEAN), public.get_administrators(), public.fn_has_capability(TEXT), public.fn_require_capability(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_administrator_provisioning(VARCHAR, VARCHAR, TEXT, TEXT), public.cancel_administrator_provisioning(UUID), public.cancel_administrator_provisioning_by_secret(VARCHAR, TEXT), public.get_administrator_provisioning_recovery(VARCHAR, TEXT), public.update_administrator(UUID, VARCHAR, TEXT, BOOLEAN), public.get_administrators(), public.fn_has_capability(TEXT), public.get_admin_audit_log(DATE, DATE, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, INTEGER), public.get_admin_audit_actors() TO authenticated;
