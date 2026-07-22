-- Resolve application roles exclusively from application-owned membership tables.

CREATE OR REPLACE FUNCTION public.get_current_principal()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_admin_name VARCHAR;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT full_name INTO v_admin_name
  FROM public.admin
  WHERE id = v_user_id;

  IF FOUND AND EXISTS (SELECT 1 FROM public.student WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Principal has conflicting memberships' USING ERRCODE = '23514';
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object('role', 'admin', 'admin_name', v_admin_name);
  END IF;

  IF EXISTS (SELECT 1 FROM public.student WHERE id = v_user_id) THEN
    RETURN jsonb_build_object('role', 'student');
  END IF;

  RAISE EXCEPTION 'No application principal exists for this user' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_principal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_principal() TO authenticated;

-- Public metadata is profile input only. Every public Auth signup creates a student.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.raw_app_meta_data ->> 'role' = 'admin' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.student (id, ci, full_name, email, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'ci',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone'
  );
  RETURN NEW;
END;
$$;

-- Direct database provisioning can still create administrators after Auth user creation.
-- Remove the transient student record created by the signup trigger before it gains history.
CREATE OR REPLACE FUNCTION public.remove_student_for_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.exam WHERE student_id = NEW.id) THEN
    RAISE EXCEPTION 'Cannot provision an administrator from a student with exam history' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.student WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_admin_created ON public.admin;
CREATE TRIGGER on_admin_created
  AFTER INSERT ON public.admin
  FOR EACH ROW EXECUTE FUNCTION public.remove_student_for_admin();

DROP POLICY IF EXISTS "student_insert_self" ON public.student;
DROP POLICY IF EXISTS "student_update_own" ON public.student;
CREATE POLICY "student_update_own" ON public.student
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

REVOKE INSERT ON TABLE public.student FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.student TO authenticated;
