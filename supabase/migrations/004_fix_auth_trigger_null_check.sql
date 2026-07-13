-- ============================================================
-- Sistema de Exámenes de Colocación CBA
-- Migration: 004_fix_auth_trigger_null_check
-- Descripción: Fix del trigger — NULL != 'admin' no funciona
--              en PostgreSQL (NULL != anything = NULL, no TRUE).
--              Se reemplaza con IS DISTINCT FROM.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Solo crear registro si NO es admin
  -- Usamos IS DISTINCT FROM para manejar NULL correctamente
  IF NEW.raw_user_meta_data ->> 'role' IS DISTINCT FROM 'admin' THEN
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
