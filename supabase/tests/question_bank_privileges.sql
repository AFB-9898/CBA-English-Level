-- Permanent contract tests for migration 010. Run after `supabase db reset` with psql.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(10);
SET search_path = public, extensions;

INSERT INTO public.admin (id, email, full_name)
VALUES ('00000000-0000-0000-0000-000000000012', 'question-bank-admin@test.local', 'Question Bank Admin')
ON CONFLICT (id) DO NOTHING;
DELETE FROM public.admin WHERE id = '00000000-0000-0000-0000-000000000013';

BEGIN;
RESET ROLE;
TRUNCATE public.student_answer, public.exam_question_option, public.exam_level_snapshot, public.exam_question, public.question_option,
  public.exam, public.question, public.student, public.audit_log;

INSERT INTO public.question (id, text, level_id, category)
VALUES (
  '00000000-0000-0000-0000-000000000110',
  'Question Bank privilege fixture',
  (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1),
  'privilege-test'
);
INSERT INTO public.question_option (id, question_id, text, is_correct, "order")
VALUES ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000110', 'Fixture option', TRUE, 0);

SELECT ok(has_table_privilege('authenticated', 'public.question', 'SELECT,INSERT,UPDATE,DELETE'),
  'authenticated has Question Bank CRUD privileges');
SELECT ok(has_table_privilege('authenticated', 'public.question_option', 'SELECT,INSERT,UPDATE,DELETE'),
  'authenticated has Question Option CRUD privileges');
SELECT ok(NOT has_table_privilege('anon', 'public.question', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon has no Question Bank table privileges');
SELECT ok(NOT has_table_privilege('anon', 'public.question_option', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon has no Question Option table privileges');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', TRUE);
SELECT ok((SELECT COUNT(*) FROM public.question WHERE id = '00000000-0000-0000-0000-000000000110') = 1,
  'authenticated administrator can query questions');
SELECT ok((SELECT COUNT(*) FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000111') = 1,
  'authenticated administrator can query question options');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', TRUE);
SELECT throws_ok(
  $$ INSERT INTO public.question (text, level_id, category) VALUES ('Denied Question', (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1), 'privilege-test') $$,
  '42501', NULL, 'non-administrator cannot create questions'
);
UPDATE public.question SET text = 'Denied update' WHERE id = '00000000-0000-0000-0000-000000000110';
RESET ROLE;
SELECT ok((SELECT text FROM public.question WHERE id = '00000000-0000-0000-0000-000000000110') = 'Question Bank privilege fixture',
  'non-administrator cannot update questions');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', TRUE);
SELECT throws_ok(
  $$ INSERT INTO public.question_option (question_id, text, is_correct, "order") VALUES ('00000000-0000-0000-0000-000000000110', 'Denied option', FALSE, 1) $$,
  '42501', NULL, 'non-administrator cannot create question options'
);
DELETE FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000111';
RESET ROLE;
SELECT ok(EXISTS (SELECT 1 FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000111'),
  'non-administrator cannot delete question options');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
