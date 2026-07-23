-- Permanent contract tests for migration 009. Run after `supabase db reset` with psql.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(20);
SET search_path = public, extensions;

INSERT INTO public.admin (id, email, full_name) VALUES
  ('00000000-0000-0000-0000-000000000009', 'audit-admin@test.local', 'Audit Admin'),
  ('00000000-0000-0000-0000-000000000011', 'audit-second@test.local', 'Second Admin')
ON CONFLICT (id) DO NOTHING;
REVOKE SELECT ON public.audit_log FROM authenticated;

BEGIN;
RESET ROLE;
TRUNCATE public.student_answer, public.exam_question_option, public.exam_level_snapshot, public.exam_question, public.question_option,
  public.exam, public.question, public.student, public.audit_log;
INSERT INTO public.audit_log (id, admin_id, action, entity, entity_id, details, created_at)
VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000009', 'edit', 'level', NULL, '{"before":{"name":"old"}}', '2026-07-01T00:00:00Z');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question, public.question_option TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000010', TRUE);
SELECT throws_ok($$ SELECT * FROM public.get_admin_audit_log() $$, '42501', 'Administrator access required', 'non-administrator cannot read audit projection');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_log', 'SELECT'), 'authenticated has no direct audit table read');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', TRUE);
INSERT INTO public.question (id, text, level_id, category)
VALUES ('00000000-0000-0000-0000-000000000101', 'Audit fixture', (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1), 'audit-test');
INSERT INTO public.question_option (id, question_id, text, is_correct, "order") VALUES
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000101', 'First answer', FALSE, 0);
UPDATE public.question SET text = 'Audit fixture updated' WHERE id = '00000000-0000-0000-0000-000000000101';
UPDATE public.question_option SET is_correct = TRUE WHERE id = '00000000-0000-0000-0000-000000000102';
DELETE FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000102';
DELETE FROM public.question WHERE id = '00000000-0000-0000-0000-000000000101';

RESET ROLE;
SELECT ok((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'question' AND action = 'create') = 1, 'question create is audited');
SELECT ok((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'question' AND action = 'edit') = 1, 'question edit is audited');
SELECT ok((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'question' AND action = 'delete') = 1, 'question delete is audited');
SELECT ok((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'question_option' AND action = 'create') = 1, 'option create is audited');
SELECT ok((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'question_option' AND action = 'answer_change') = 1, 'correct-answer changes have a distinct action');
SELECT ok((SELECT COUNT(*) FROM public.audit_log WHERE entity = 'question_option' AND action = 'delete') = 1, 'option delete is audited');
SELECT ok((SELECT admin_id FROM public.audit_log WHERE entity = 'question' AND action = 'create') = auth.uid(), 'question audit records auth.uid actor');
SELECT ok((SELECT details ? 'before' AND details ? 'after' FROM public.audit_log WHERE entity = 'question_option' AND action = 'answer_change'), 'option audit retains before and after snapshots');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', TRUE);
SELECT ok((SELECT COUNT(*) FROM public.get_admin_audit_log(NULL, NULL, '00000000-0000-0000-0000-000000000009', 'question_option', 'answer_change', NULL, NULL, 25)) = 1, 'authorized filters return matching projected event');
SELECT ok((SELECT summary FROM public.get_admin_audit_log(NULL, NULL, NULL, 'question_option', 'answer_change', NULL, NULL, 25) LIMIT 1) = 'Changed correct answer', 'projection returns safe server summary');
SELECT ok((SELECT display_name FROM public.get_admin_audit_actors() WHERE admin_id = '00000000-0000-0000-0000-000000000009') = 'Audit Admin', 'authorized actor filter options are projected safely');
SELECT ok((SELECT COUNT(*) FROM public.get_admin_audit_log('2026-07-01', '2026-07-01', NULL, 'level', 'edit', NULL, NULL, 1)) = 1, 'date and entity filters retain existing audit records');
SELECT ok((SELECT COUNT(*) FROM public.get_admin_audit_log(NULL, NULL, NULL, NULL, NULL, now() + INTERVAL '1 day', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 25)) > 0, 'complete keyset cursor returns the following timeline rows');
SELECT throws_ok($$ SELECT * FROM public.get_admin_audit_log(NULL, NULL, NULL, NULL, NULL, now(), NULL, 25) $$, NULL, 'Audit cursor must include timestamp and ID', 'partial cursor is rejected');
SELECT throws_ok($$ SELECT * FROM public.get_admin_audit_log(NULL, NULL, NULL, NULL, NULL, NULL, NULL, 101) $$, NULL, 'Audit page size must be between one and 100', 'page size is bounded');

RESET ROLE;
SELECT ok((SELECT details FROM public.audit_log WHERE id = '00000000-0000-0000-0000-000000000100') = '{"before":{"name":"old"}}'::jsonb, 'existing audit records are preserved');
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_question_insert_fails CHECK (entity <> 'question' OR entity_id <> '00000000-0000-0000-0000-000000000103');
SELECT throws_ok($$ INSERT INTO public.question (id, text, level_id, category) VALUES ('00000000-0000-0000-0000-000000000103', 'Rejected audit fixture', (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1), 'audit-test') $$, '23514', NULL, 'audit insertion failure aborts question mutation');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.question WHERE id = '00000000-0000-0000-0000-000000000103'), 'failed question audit leaves no question mutation');
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_question_insert_fails;

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
