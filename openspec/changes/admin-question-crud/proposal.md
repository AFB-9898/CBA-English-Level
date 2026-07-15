# Proposal: Admin Question CRUD

## Intent

The question bank has a fully deployed database layer (tables, RLS, triggers) and TypeScript types, but zero frontend implementation. The `/admin/questions` route renders a `PlaceholderPage`. Admins cannot create, read, update, or delete questions — the core content that powers the placement exam. This change closes that gap so the question bank is manageable before student-facing exam modules are built.

## Scope

### In Scope
- List view with level/category filtering and pagination
- Create form: question text, level dropdown, category input, dynamic option list (add/remove, text + is_correct toggle)
- Edit form: same as create, pre-filled, deep-linkable via `/admin/questions/:id/edit`
- Delete with confirmation modal; graceful handling of FK RESTRICT (question in use by exams)
- `useQuestions` hook (CRUD operations via Supabase client)
- `useLevels` hook (reusable fetch from `level` table)
- New interfaces: `QuestionWithLevel`, `QuestionFormData`, `QuestionOptionFormData`
- i18n keys: `questions.*` namespace in `en.json` and `es.json`
- Route wiring: replace `PlaceholderPage` with `QuestionsScreen` in `App.tsx`

### Out of Scope
- Student exam-taking flow
- Question import/export (CSV/Excel)
- Question types beyond multiple-choice (schema only supports MCQ today)
- Soft delete (requires `deleted_at` migration)
- Category enum/lookup table (freeform for now)

## Capabilities

> Contract between proposal and specs phases. Research `openspec/specs/` completed — 3 existing specs found.

### New Capabilities
- `admin-question-management`: Full question CRUD — list view with filtering/pagination, create/edit form with dynamic MCQ options, delete with confirmation, validation rules (min 4 options, exactly 1 correct), and level assignment.

### Modified Capabilities
- `admin-sidebar`: Question link changes from placeholder (`#` href) to functional route (`/admin/questions`). Requirement S3 scope narrows for the Questions entry only.

## Approach

**Approach B: List Page + Separate Create/Edit Page** (per exploration recommendation).

- `/admin/questions` — table with filters, "New Question" button
- `/admin/questions/new` — create form
- `/admin/questions/:id/edit` — edit form (deep-linkable)
- Two new hooks call Supabase directly (no services layer, matching existing pattern)
- Atomic Design: `QuestionsScreen` (screen), `QuestionForm` (organism), `QuestionRow` (molecule)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | Modified | Replace `PlaceholderPage` with `QuestionsScreen` and add nested routes |
| `src/pages/QuestionsScreen.tsx` | New | Main screen: list + routing to create/edit |
| `src/components/organisms/QuestionForm.tsx` | New | Create/edit form with dynamic options |
| `src/components/molecules/QuestionRow.tsx` | New | Table row component |
| `src/hooks/useQuestions.ts` | New | CRUD hook (list, create, update, delete) |
| `src/hooks/useLevels.ts` | New | Level fetch hook (reusable for dashboard) |
| `src/types/index.ts` | Modified | Add `QuestionWithLevel`, `QuestionFormData`, `QuestionOptionFormData` |
| `src/locales/en.json` | Modified | Add `questions.*` namespace |
| `src/locales/es.json` | Modified | Add `questions.*` namespace |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| FK RESTRICT blocks deletion of questions used in exams | High | Catch Supabase error; show user-friendly message |
| No DB constraint enforces exactly 1 correct answer | Medium | Frontend validation: radio selection + submit guard |
| Change size (700–900 lines) exceeds 400-line PR budget | High | Chained PRs recommended (see Review Workload) |
| Category is freeform, no consistent values | Medium | Frontend offers suggested dropdown; accept freeform |

## Rollback Plan

All changes are frontend-only — no database migrations. Revert steps:
1. Restore `PlaceholderPage` import in `App.tsx` for `/admin/questions` route
2. Remove new files: `QuestionsScreen.tsx`, `QuestionForm.tsx`, `QuestionRow.tsx`, `useQuestions.ts`, `useLevels.ts`
3. Revert additions to `types/index.ts`, `en.json`, `es.json`
4. No data loss possible — no backend changes involved

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines | 700–900 |
| PR budget | 400 |
| **400-line budget risk** | **High** |
| **Chained PRs recommended** | **Yes** |
| **Decision needed before apply** | **Yes** |

### Recommended Review Slices

| PR | Scope | Est. Lines | Dependency |
|----|-------|------------|------------|
| PR 1 | Types, hooks (`useQuestions`, `useLevels`), i18n keys | ~200 | None |
| PR 2 | `QuestionRow` molecule, `QuestionsScreen` list view | ~250 | PR 1 |
| PR 3 | `QuestionForm` organism, create/edit routes, delete flow | ~350 | PR 2 |

## Dependencies

- Supabase client (`src/lib/supabase.ts`) — already configured
- Admin auth + RLS policies — already deployed
- Level data (5 seeded rows) — already in database
- `react-router-dom`, `react-i18next` — already installed
- No new external dependencies required

## Success Criteria

- [ ] Admin can list all questions with level/category filtering and pagination
- [ ] Admin can create a question with text, level, category, and 4+ options (exactly 1 correct)
- [ ] Admin can edit an existing question including reassigning level/category
- [ ] Admin can delete a question; FK RESTRICT errors show a friendly message
- [ ] Deep links `/admin/questions/new` and `/admin/questions/:id/edit` work
- [ ] Sidebar Questions link navigates to `/admin/questions` (no longer placeholder)
- [ ] All new text is i18n-enabled (English + Spanish)
- [ ] Responsive layout works on mobile (320px+) through desktop
