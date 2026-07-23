-- Local-only lifecycle fixture. Loaded only by rollback-safe lifecycle tests.
INSERT INTO public.question (id, text, level_id, category) VALUES
  ('00000000-0000-0000-0000-000000000311', 'Fixture: choose the complete sentence.',
   (SELECT id FROM public.level WHERE is_active ORDER BY min_score LIMIT 1), 'fixture');

INSERT INTO public.question_option (id, question_id, text, is_correct, "order") VALUES
  ('00000000-0000-0000-0000-000000000321', '00000000-0000-0000-0000-000000000311', 'She is ready.', TRUE, 0),
  ('00000000-0000-0000-0000-000000000322', '00000000-0000-0000-0000-000000000311', 'She are ready.', FALSE, 1),
  ('00000000-0000-0000-0000-000000000323', '00000000-0000-0000-0000-000000000311', 'She ready is.', FALSE, 2);
