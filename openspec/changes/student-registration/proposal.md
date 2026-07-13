# Proposal: Student Registration

## Intent

Students currently have no way to create accounts. The system needs a self-service registration flow so students can sign up with their personal data (full name, CI, email, phone, password) and later take placement exams. The database layer (table, trigger, RLS) already supports this — only the frontend is missing.

## Scope

### In Scope
- Registration page with form: full_name, CI, email, phone, password
- Form calls `supabase.auth.signUp()` with user metadata (ci, full_name, phone)
- Auth trigger (`on_auth_user_created`) auto-creates the `student` row — no backend work needed
- Post-registration redirect to `/login` with success confirmation
- Client-side validation (required fields, CI format, email format, password length)
- Error handling: duplicate email, duplicate CI, network errors
- Mobile-first responsive layout matching LoginPage style
- Route `/register` added to the router

### Out of Scope
- Student login (separate change)
- Taking exams
- Profile editing after registration
- Password reset flow
- Email verification flow (auto-confirm is enabled)
- Any database or RLS changes (already in place)

## Capabilities

> This section is the CONTRACT between proposal and specs phases.

### New Capabilities
- `student-registration`: Registration form, signUp with metadata, validation, error handling, post-registration redirect

### Modified Capabilities
None — `admin-auth` requirements are not affected.

## Approach

- Create `RegisterPage.tsx` under `src/pages/` following LoginPage's PageShell pattern
- Create `RegisterForm.tsx` as an organism under `src/components/organisms/` with controlled form inputs
- Call `supabase.auth.signUp({ email, password, options: { data: { ci, full_name, phone } } })`
- The existing `on_auth_user_created` trigger handles the rest (student row creation)
- Add `/register` route to `App.tsx`
- Add a "Register" link on LoginPage and "Already have an account?" link on RegisterPage
- Map Supabase error codes to user-friendly messages (duplicate email, duplicate CI)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/pages/RegisterPage.tsx` | New | Registration page with PageShell |
| `src/components/organisms/RegisterForm.tsx` | New | Registration form component |
| `src/App.tsx` | Modified | Add `/register` route |
| `src/pages/LoginPage.tsx` | Modified | Add "Register" link |
| `src/types/auth.ts` | No change | Existing types sufficient |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicate CI/email rejection from trigger | Low | Map Supabase errors to friendly messages ("This CI is already registered") |
| signUp auto-confirm off in production | Low | Verified: auto-confirm is enabled. Verify before deploy. |
| User metadata fields missing from trigger | Low | Trigger already handles ci, full_name, phone. Verified in `003_auth_triggers.sql`. |

## Rollback Plan

Delete `RegisterPage.tsx`, `RegisterForm.tsx`, remove `/register` route from `App.tsx`, remove login page link. No database changes to revert — the trigger and RLS policy are additive and harmless without frontend usage.

## Dependencies

- Supabase Auth with auto-confirm enabled
- Existing `on_auth_user_created` trigger (already deployed)
- `react-router-dom` (already installed)

## Success Criteria

- [ ] Student can register at `/register` with full_name, CI, email, phone, password
- [ ] Successful registration redirects to `/login` with confirmation message
- [ ] Duplicate email shows inline error: "This email is already registered"
- [ ] Duplicate CI shows inline error: "This CI is already registered"
- [ ] Form validates required fields client-side before submission
- [ ] Registration form is responsive and works at 320px+ width
- [ ] Auth trigger creates the student row automatically after signUp
