# Exploration: Admin Question CRUD

## Current State

The question bank infrastructure exists at the database level but has zero frontend implementation:

**Database layer (fully deployed):**
- `question` table: `id` (UUID PK), `text` (TEXT NOT NULL), `level_id` (UUID FK → level ON DELETE RESTRICT), `category` (VARCHAR(100) nullable), `created_at`, `updated_at`
- `question_option` table: `id` (UUID PK), `question_id` (UUID FK → question CASCADE), `text` (TEXT NOT NULL), `is_correct` (BOOLEAN DEFAULT FALSE), `order` (INTEGER ≥ 0), UNIQUE(question_id, order)
- Index: `idx_question_level_id` already exists on `question(level_id)`
- Trigger: `trg_question_updated_at` auto-updates `updated_at` on question UPDATE

**RLS policies (fully deployed):**
- `question_select_all` — everyone can read (SELECT USING true)
- `question_insert_admin` — only admin can insert (INSERT CHECK auth.uid() IN admin)
- `question_update_admin` — only admin can update
- `question_delete_admin` — only admin can delete
- `question_option` — identical policy set (select all, insert/update/delete admin-only)

**Levels (seeded, 5 CEFR-aligned):**

| Level | Score Range | Description |
|-------|-------------|-------------|
| Beginner | 0–20 | Principiante |
| Elementary | 21–40 | Básico |
| Intermediate | 41–60 | Intermedio |
| Upper Intermediate | 61–80 | Intermedio Alto |
| Advanced | 81–100 | Avanzado |

**TypeScript types (already defined in `src/types/index.ts`):**
- `Question { id, text, level_id, category, created_at, updated_at }`
- `QuestionOption { id, question_id, text, is_correct, order }`

**Frontend:** The `/admin/questions` route exists in `App.tsx` but renders a `PlaceholderPage`. The sidebar link exists in `AdminLayout.tsx` pointing to `/admin/questions`. No question components, hooks, or services exist.

**Exam config:** `exam_config.questions_per_exam = 30` — the system pulls random questions via `fn_get_random_questions(p_count)`, which selects from the entire `question` table without level filtering. This means the question bank must have enough questions across levels for meaningful random selection.

---

## Affected Areas

| File | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | Modified | Replace `PlaceholderPage` with `QuestionsScreen` at `/admin/questions` |
| `src/pages/QuestionsScreen.tsx` | New | Main question management screen (list + create/edit form) |
| `src/components/organisms/QuestionForm.tsx` | New | Create/edit question form with dynamic options |
| `src/components/molecules/QuestionRow.tsx` | New | Single question row in the list table |
| `src/hooks/useQuestions.ts` | New | CRUD hook for questions (list, create, update, delete) |
| `src/hooks/useLevels.ts` | New | Fetch levels for the dropdown (reusable for dashboard too) |
| `src/types/index.ts` | Modified | Add `QuestionWithLevel`, `QuestionFormData`, `QuestionOptionFormData` interfaces |
| `src/locales/en.json` | Modified | Add `questions.*` namespace |
| `src/locales/es.json` | Modified | Add `questions.*` namespace |

---

## Question Model — Evidence-Based Analysis

### What the schema supports

1. **Question types**: The schema has a single `text` field for the question and a separate `question_option` table with `is_correct` boolean. This means the current model is multiple-choice only (select the correct option from a list). There is no `type` field to distinguish between question formats (e.g., fill-in-blank, true/false, matching).

2. **Difficulty/CEFR mapping**: Each question links to exactly one `level_id` (FK → level). The level determines difficulty. There is no separate `difficulty` or `points` field — difficulty is implicit in the level assignment.

3. **Categories**: The `category` field is VARCHAR(100) nullable. No enum or lookup table constrains its values. The seed data does not populate categories. This is a freeform text field — likely used for grouping questions by skill area (grammar, vocabulary, reading, etc.).

4. **Options per question**: The `question_option` table enforces UNIQUE(question_id, order), so each question can have multiple options ordered sequentially. The `is_correct` boolean marks the correct answer. No database constraint enforces minimum options (must be validated in the frontend/RLS).

5. **Correct answer constraint**: The schema does NOT enforce exactly one correct answer per question. The `is_correct` column is a simple boolean on each option. This MUST be validated at the application level.

6. **Question deletion cascade**: `question_option.question_id` has ON DELETE CASCADE — deleting a question removes its options. However, `exam_question.question_id` has ON DELETE RESTRICT — you cannot delete a question that has been used in an exam. This is a critical business rule.

### Validation rules (derived from schema + AGENTS.md)

| Rule | Source | Implementation |
|------|--------|----------------|
| Question text required | `text TEXT NOT NULL` | Frontend + RLS |
| At least one option | `question_option` exists | Frontend |
| At least 4 options (recommendation) | Best practice for MCQ | Frontend validation |
| Exactly 1 correct answer | Business rule | Frontend + SQL function |
| Option text required | `text TEXT NOT NULL` | Frontend + RLS |
| Level must exist | `level_id FK → level` | FK constraint |
| Cannot delete question in use | `exam_question.question_id RESTRICT` | FK constraint (DB error) |
| Level cannot be changed on question in use | Business rule | Frontend guard |

---

## Admin Workflow

### List View
- Table with columns: Question Text, Level, Category, Options Count, Created Date, Actions
- Filter by level (dropdown), filter by category (dropdown or text search)
- Pagination (questions could number in hundreds/thousands)
- Action buttons: Edit, Delete (with confirmation)
- "New Question" button at top

### Create/Edit Form
- Question text: textarea
- Level: dropdown populated from `level` table
- Category: text input or dropdown (if categories are predefined)
- Options: dynamic list (add/remove), each with text input + is_correct radio/toggle
- Validation: minimum 4 options, exactly 1 correct, all texts required
- Save calls Supabase insert/update

### Delete Flow
- Click delete → confirmation modal
- If question is in use (exam_question has rows), Supabase FK RESTRICT will return an error
- Error message: "Cannot delete: this question has been used in exams"
- Alternative: soft delete (add `deleted_at` column) — but this requires a migration, not in current scope

---

## Approaches

### Approach A: Single Page with Modal Form

List table + "New Question" button opens a modal/inline form. Edit also opens the modal pre-filled.

| Aspect | Detail |
|--------|--------|
| Pros | Fewer routes, familiar admin pattern, fast iteration |
| Cons | Modal complexity for a form with dynamic options, poor mobile UX for long forms |
| Effort | Medium |
| Change Size | ~600–800 lines |

### Approach B: List Page + Separate Create/Edit Page

`/admin/questions` shows the table. `/admin/questions/new` and `/admin/questions/:id/edit` are separate form pages.

| Aspect | Detail |
|--------|--------|
| Pros | Clean separation, better mobile UX, deep-linkable, follows React Router patterns |
| Cons | More routes, slightly more navigation steps |
| Effort | Medium |
| Change Size | ~700–900 lines |

### Approach C: Split-Pane (List Left, Form Right)

Desktop: table on left, form on right. Mobile: toggle between views.

| Aspect | Detail |
|--------|--------|
| Pros | Fast editing loop (no page transitions), good for power users |
| Cons | Complex responsive layout, harder to maintain, overkill for this project scale |
| Effort | High |
| Change Size | ~900–1100 lines |

---

## Recommendation

**Approach B: List Page + Separate Create/Edit Page.**

Reasoning:
1. Matches the existing routing pattern in `App.tsx` (nested routes under `/admin`)
2. Better mobile UX — forms with dynamic option lists need full-screen on small devices
3. Deep-linkable — admin can bookmark `/admin/questions/new` or share links
4. Follows the same pattern as the admin-dashboard change (screen-level components)
5. The project already uses `react-router-dom` with nested routes, so adding `/admin/questions/new` and `/admin/questions/:id/edit` is natural
6. Easier to test — each page is an independent render tree

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| FK RESTRICT blocks deletion of questions used in exams | High | Medium | Catch the Supabase error, show user-friendly message explaining why |
| No `type` column means only MCQ supported | Low | Low | Accept for now; future migration can add `type` column if needed |
| Category is freeform — no consistent values | Medium | Low | Frontend can offer a dropdown with suggested categories; store whatever user types |
| Question bank too small for meaningful random selection | Medium | Medium | Seed data or admin workflow must ensure sufficient question count per level |
| `is_correct` not enforced at DB level (multiple correct answers possible) | Medium | High | Frontend validation + consider a SQL check constraint in future migration |
| Large change size (700–900 lines) exceeds 400-line PR budget | High | Low | Use chained PRs or size exception (same approach as admin-dashboard) |
| No services layer — hooks call Supabase directly | Low | Low | Accept existing pattern; extract services in a future refactor |

---

## Dependencies

- Supabase client (`src/lib/supabase.ts`) — already configured
- Admin auth + RLS policies for question/question_option — already deployed
- Level data (seeded, 5 rows) — already in database
- `react-router-dom` — already installed
- `react-i18next` — already configured
- Vitest + Testing Library — already installed

---

## Ready for Proposal

**Yes** — the exploration is complete. The orchestrator should proceed to `sdd-propose` for `admin-question-crud`. Key items to include in the proposal:

1. **Scope**: Full CRUD for questions + options, list with filtering, create/edit form, delete with confirmation
2. **DB constraints**: Question in use cannot be deleted (FK RESTRICT) — this is a business rule, not a bug
3. **Validation**: At least 4 options, exactly 1 correct answer — enforced in frontend
4. **Change size**: ~700–900 lines, expect to need size exception or chained PRs
5. **No new dependencies**: Everything needed is already installed
6. **No backend changes**: RLS policies and tables are already in place
