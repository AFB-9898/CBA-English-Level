\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA public;
SELECT plan(26);
SET search_path = public, extensions;
BEGIN;
RESET ROLE;
INSERT INTO public.admin (id,email,full_name,role,is_active) VALUES
  ('00000000-0000-0000-0000-000000000701','master@test.local','Master','master_admin',true),
  ('00000000-0000-0000-0000-000000000702','admin@test.local','Admin','admin',true),
  ('00000000-0000-0000-0000-000000000703','inactive@test.local','Inactive','admin',false);
DELETE FROM public.admin WHERE id = '00000000-0000-0000-0000-000000000101';
INSERT INTO public.question (id,text,level_id,category) VALUES
  ('00000000-0000-0000-0000-000000000110','Question Bank privilege fixture',(SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1),'rbac-test');
INSERT INTO public.question_option (id,question_id,text,is_correct,"order") VALUES
  ('00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000110','Fixture option',true,0);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000701',true);
SELECT ok(public.fn_has_capability('administrator_management'),'master can manage administrators');
SELECT ok(public.fn_has_capability('levels'),'master can manage CEFR levels');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000702',true);
SELECT ok(public.fn_has_capability('students'),'admin has operational student access');
SELECT ok(public.fn_has_capability('questions'),'admin has operational question access');
SELECT ok(public.fn_has_capability('reports'),'admin has operational report access');
SELECT ok(NOT public.fn_has_capability('administrator_management'),'admin cannot manage administrators');
SELECT ok(NOT public.fn_has_capability('levels'),'admin cannot manage CEFR levels');
SELECT ok(NOT public.fn_has_capability('audit'),'admin cannot access audit');
SELECT throws_ok($$ SELECT * FROM public.get_administrators() $$,'42501',NULL,'admin is denied administrator listing');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000703',true);
SELECT ok(NOT public.fn_is_active_admin(),'inactive administrator has no access');
SELECT throws_ok(
  $$ INSERT INTO public.question (id,text,level_id,category) VALUES ('00000000-0000-0000-0000-000000000704','Inactive question',(SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1),'rbac-test') $$,
  '42501',NULL,'inactive administrator cannot insert questions'
);
UPDATE public.question SET text = 'Inactive update' WHERE id = '00000000-0000-0000-0000-000000000110';
RESET ROLE;
SELECT is((SELECT text FROM public.question WHERE id = '00000000-0000-0000-0000-000000000110'),'Question Bank privilege fixture','inactive administrator cannot update questions');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000703',true);
DELETE FROM public.question WHERE id = '00000000-0000-0000-0000-000000000110';
RESET ROLE;
SELECT ok(EXISTS (SELECT 1 FROM public.question WHERE id = '00000000-0000-0000-0000-000000000110'),'inactive administrator cannot delete questions');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000703',true);
SELECT throws_ok(
  $$ INSERT INTO public.question_option (id,question_id,text,is_correct,"order") VALUES ('00000000-0000-0000-0000-000000000705','00000000-0000-0000-0000-000000000110','Inactive option',false,1) $$,
  '42501',NULL,'inactive administrator cannot insert question options'
);
UPDATE public.question_option SET text = 'Inactive update' WHERE id = '00000000-0000-0000-0000-000000000111';
RESET ROLE;
SELECT is((SELECT text FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000111'),'Fixture option','inactive administrator cannot update question options');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000703',true);
DELETE FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000111';
RESET ROLE;
SELECT ok(EXISTS (SELECT 1 FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000111'),'inactive administrator cannot delete question options');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000702',true);
SELECT lives_ok(
  $$ INSERT INTO public.question (id,text,level_id,category) VALUES ('00000000-0000-0000-0000-000000000706','Active question',(SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1),'rbac-test') $$,
  'active administrator can insert questions'
);
UPDATE public.question SET text = 'Active question update' WHERE id = '00000000-0000-0000-0000-000000000706';
RESET ROLE;
SELECT is((SELECT text FROM public.question WHERE id = '00000000-0000-0000-0000-000000000706'),'Active question update','active administrator can update questions');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000702',true);
SELECT lives_ok(
  $$ INSERT INTO public.question_option (id,question_id,text,is_correct,"order") VALUES ('00000000-0000-0000-0000-000000000707','00000000-0000-0000-0000-000000000706','Active option',true,0) $$,
  'active administrator can insert question options'
);
UPDATE public.question_option SET text = 'Active option update' WHERE id = '00000000-0000-0000-0000-000000000707';
RESET ROLE;
SELECT is((SELECT text FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000707'),'Active option update','active administrator can update question options');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000702',true);
DELETE FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000707';
RESET ROLE;
SELECT ok(NOT EXISTS (SELECT 1 FROM public.question_option WHERE id = '00000000-0000-0000-0000-000000000707'),'active administrator can delete question options');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000702',true);
DELETE FROM public.question WHERE id = '00000000-0000-0000-0000-000000000706';
RESET ROLE;
SELECT ok(NOT EXISTS (SELECT 1 FROM public.question WHERE id = '00000000-0000-0000-0000-000000000706'),'active administrator can delete questions');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000701',true);
INSERT INTO public.student (id,ci,full_name,email) VALUES ('00000000-0000-0000-0000-000000000708','student-principal','Student Principal','student-principal@test.local');
SELECT throws_ok(
  $$ SELECT * FROM public.create_administrator_provisioning('student-principal@test.local','Student Principal','admin','ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') $$,
  '23514','Email already belongs to an application principal','student principals cannot be provisioned as administrators'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000701',true);
SELECT throws_ok($$ UPDATE public.admin SET is_active=false WHERE id='00000000-0000-0000-0000-000000000701' $$,'42501','Administrators cannot deactivate themselves','master cannot self-deactivate');
INSERT INTO public.audit_log (admin_id,action,entity,details) VALUES ('00000000-0000-0000-0000-000000000701','create','administrator','{}');
SELECT throws_ok($$ UPDATE public.audit_log SET action='edit' WHERE entity='administrator' $$,'42501','Administrator audit records are append-only','administrator audit is immutable');
SELECT throws_ok($$ DELETE FROM public.admin WHERE id='00000000-0000-0000-0000-000000000701' $$,'23514','At least one active master administrator is required','last active master cannot be removed');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
