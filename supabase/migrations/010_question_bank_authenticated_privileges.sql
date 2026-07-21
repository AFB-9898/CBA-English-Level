-- Direct Question Bank CRUD is authorized by the existing RLS policies.
-- PostgREST also requires table privileges for the authenticated role.
REVOKE ALL ON TABLE public.question, public.question_option FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question, public.question_option TO authenticated;
