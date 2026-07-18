## Exploration: Administrator CEFR Level Management

### Current State

The `level` table already exists in both migration trees (`supabase/migrations/` and the legacy-looking `database/migrations/`) with this contract:

- `id UUID` primary key, `name VARCHAR(100) NOT NULL`, `min_score INTEGER NOT NULL CHECK (min_score >= 0)`, `max_score INTEGER NOT NULL CHECK (max_score > min_score)`, and nullable `description`.
- Seed data contains five broad labels (`Beginner`, `Elementary`, `Intermediate`, `Upper Intermediate`, `Advanced`) covering 0–100 with contiguous ranges. The database does not currently encode that they are CEFR codes, that scores must be ≤100, that ranges must be contiguous/non-overlapping, or that names are unique.
- `fn_calculate_level` and `fn_complete_exam` select a matching range using `BETWEEN`, ordered by `min_score`, and return the first match. Overlapping ranges therefore have order-dependent behavior; gaps return no level.
- `question.level_id` is `NOT NULL` with `ON DELETE RESTRICT`; `exam.level_id` is nullable with `ON DELETE RESTRICT`; `exam_question` and `student_answer` retain question history with `ON DELETE RESTRICT`. Consequently, deleting a level referenced by questions or exams is rejected by PostgreSQL. There is no soft-delete column, level-delete trigger, level audit trigger, or database protection against changing a level that historical exams reference.
- RLS allows public `SELECT` on `level`, while `INSERT`, `UPDATE`, and `DELETE` require `auth.uid()` to exist in `admin`. This is the existing authorization boundary; it should not be weakened by a frontend implementation.

The frontend has a read-only `useLevels` hook that orders levels by `min_score`. It is reused by question filters and the question form. The admin router has working `/admin/questions` plus placeholder `/admin/students` and `/admin/audit-log` routes; the sidebar currently exposes four links (Dashboard, Students, Questions, Audit Log) and has no Levels link. Question management already depends on level IDs and shows an i18n FK error when a level disappears concurrently.

There is no level-management screen, CRUD hook, level-specific type beyond the existing `Level` interface, or level-specific translation namespace. Existing UI and hook tests use Vitest + Testing Library with mocked Supabase chains. The project uses React 19, TypeScript, Vite, Tailwind, Supabase SDK, React Router, and `react-i18next`; OpenSpec requires Given/When/Then scenarios and separates frontend from Supabase/RLS changes.

### Affected Areas

- `supabase/migrations/001_schema.sql` — authoritative deployed schema candidate: level constraints, score functions, FK deletion behavior, and RLS policies.
- `supabase/migrations/002_seed.sql` — current seeded level names, descriptions, and 0–100 ranges.
- `database/migrations/001_schema.sql`, `database/migrations/002_seed.sql` — duplicate migration tree; implementation must establish which tree is authoritative before changing schema or seed data.
- `src/types/index.ts` — existing `Level` interface is sufficient for current columns; mutation payload types may be needed only after rules are confirmed.
- `src/hooks/useLevels.ts` — read-only query and reusable dependency for questions/dashboard; likely extraction point for list/refetch and mutation behavior.
- `src/hooks/useQuestions.ts`, `src/pages/QuestionsScreen.tsx`, `src/components/organisms/QuestionForm.tsx` — consume levels and must remain safe when levels are renamed, range-edited, or deletion is rejected.
- `src/App.tsx`, `src/pages/AdminLayout.tsx` — route and sidebar placeholder integration; current sidebar specification explicitly describes only four links.
- `src/locales/es.json`, `src/locales/en.json` — all new management UI, validation, confirmation, and FK/error messages must be bilingual and follow existing namespaces.
- `src/hooks/__tests__/useLevels.test.tsx`, `src/pages/__tests__/AdminLayout.test.tsx`, `src/pages/__tests__/QuestionsScreen.test.tsx`, and analogous component tests — established mock-chain, route, loading/error, responsive-navigation, and CRUD test patterns.
- `openspec/specs/admin-sidebar/spec.md` — must be considered a modified capability if a Levels navigation item is added.
- `openspec/specs/admin-question-management/spec.md` — existing level dependency and concurrent-level-deletion scenario must remain valid.

### Approaches

1. **Frontend CRUD on the existing `level` contract** — add a list/form screen, hook mutations, route, sidebar item, i18n, and tests while relying on current RLS and FK restrictions.
   - Pros: smallest change; reuses `Level`, `useLevels`, Supabase SDK, and existing admin patterns; no migration synchronization work.
   - Cons: current database permits overlapping/gapped/out-of-domain ranges; changing referenced levels can alter the meaning of future score calculations and historical display; delete failures are only discovered after submission.
   - Effort: Medium

2. **Contract-first level management** — first define and enforce score-range invariants and historical-level policy in the authoritative migration (constraints/functions/triggers as justified), then build the frontend against that contract.
   - Pros: critical rules are enforced independently of the UI and concurrent clients; deterministic score classification; safer deletion/update behavior for question and exam history.
   - Cons: requires resolving the duplicate migration trees and deciding rules not currently present; broader rollout and migration testing; may require an explicit policy for immutable or referenced levels.
   - Effort: High

3. **Admin-only mutation RPC/SQL function** — keep direct read access but expose validated create/update/delete operations through a database function, with frontend hooks calling the RPC.
   - Pros: centralizes validation and can make multi-check operations atomic; preserves RLS as the authorization layer.
   - Cons: adds RPC contracts and migration complexity; still requires decisions about historical references and range semantics; inconsistent with the current direct-table CRUD pattern unless the benefit is justified.
   - Effort: High

### Recommendation

Use approach 2 as the implementation sequence, with approach 1 only if the product owner explicitly accepts the current range semantics and a no-schema-change scope. Before proposal, confirm the level vocabulary (the seed values are descriptive bands, not explicit A1–C2 codes), score domain, whether ranges must be contiguous and non-overlapping, whether ranges may be edited after exams exist, and whether referenced levels are deleted, archived, or immutable. Then identify the authoritative migration tree, encode only the approved critical invariants in Supabase, and implement the frontend list/form workflow using the existing admin layout, `useLevels` patterns, RLS, i18n, and Vitest conventions.

Recommended implementation order:

1. Resolve product rules and migration-source ownership; document the impact on `fn_calculate_level`/`fn_complete_exam` and historical exams.
2. Add/adjust backend constraints or an admin mutation contract and test inserts, updates, overlap/gap boundaries, score 0/100, and deletion with question/exam references.
3. Extend the shared level data hook with refetch and mutation/error-code handling without breaking question-management consumers.
4. Add the responsive admin Levels route/list/form and sidebar link, with explicit delete confirmation and dependency-aware errors.
5. Add Spanish/English translations and focused hook, screen, route/sidebar, validation, and integration tests; run the existing build and test commands.

The likely UI workflow is: open `/admin/levels`, review levels ordered by `min_score`, create or edit a level, validate locally for immediate feedback, submit through the backend contract, refetch the list, and delete only after confirmation. A failed delete must explain that questions or exams reference the level. The workflow must not imply that deleting a level can remove question or exam history.

### Risks

- **Unspecified score semantics:** current constraints allow `max_score > min_score` but do not cap scores at 100 or prevent overlapping/gapped ranges. Implementing assumptions in the UI alone would create inconsistent classifications.
- **Historical integrity:** `exam.level_id` is a foreign key, but the level’s name/ranges remain mutable. Editing a referenced level can change how old results are interpreted or displayed; deletion is blocked only by FK references.
- **Duplicate migration sources:** applying a fix to only `supabase/migrations` or only `database/migrations` can leave local documentation/rebuilds inconsistent.
- **Question-management coupling:** deleting a level is already rejected when questions reference it; question filters/forms must handle renamed levels and concurrent deletion without stale selections.
- **Authorization and audit gap:** RLS protects mutations, but the current schema does not attach automatic level CRUD audit triggers. If auditability is required, it must be specified rather than assumed.
- **Delivery size:** a cohesive backend contract plus frontend CRUD, sidebar/spec updates, translations, and tests is likely Medium–High and may exceed the 400-line review budget. A task-phase forecast should decide whether to split backend contract and frontend management into chained work units.

### Ready for Proposal

No — technical discovery is complete, but proposal work should first state the unresolved product decisions: exact CEFR naming/vocabulary, score-range invariants, referenced-level update policy, deletion/archive policy, authoritative migration directory, and whether level changes require audit records. Once those are confirmed, the change is ready for proposal and then separate frontend/Supabase specs.
