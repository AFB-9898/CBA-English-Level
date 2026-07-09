-- ============================================================
-- Sistema de Exámenes de Colocación CBA
-- Migration: 003_auth_triggers
-- Descripción: Trigger para auto-crear student al registrarse
-- ============================================================

-- 1. Función que se ejecuta al crear un nuevo usuario en Auth
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Solo crear registro si NO es admin
  IF NEW.raw_user_meta_data ->> 'role' != 'admin' THEN
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

-- 2. Trigger sobre auth.users
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
