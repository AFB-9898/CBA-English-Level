# Tasks: Student Registration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–420 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (within budget) |
| Delivery strategy | single-pr (user approved) |
| Chain strategy | N/A |

## Phase 1: Utilities

- [x] 1.1 Create `src/utils/validateRegistration.ts` — export `RegistrationFields` interface, `FieldErrors` type, and `validateRegistration()` pure function. Validate: full_name required + max 200, ci required + 3–20 chars + `/^[A-Za-z0-9 -]+$/`, email required + valid format, phone optional + `/^\d{7,15}$/` if provided, password required + min 8 chars.
- [x] 1.2 Create `src/utils/mapAuthError.ts` — export `mapAuthError()` that maps Supabase error codes/messages to `{ field, message }`. Handle: `signup_disabled` → general banner, `email_address_not_valid` → email field, duplicate email → email field ("This email is already registered"), duplicate CI → ci field ("This CI is already registered"), network/unknown → general banner ("Network error. Please try again.").

## Phase 2: RegisterForm Organism

- [x] 2.1 Create `src/components/organisms/RegisterForm.tsx` — controlled `useState` for 5 fields (full_name, ci, email, phone, password), per-field error state, `onSubmit` calls `validateRegistration()` then `supabase.auth.signUp({ email, password, options: { data: { ci, full_name, phone } } })`. On success call `onSuccess` prop. On error call `mapAuthError()` and set field or general error. Export `RegisterFormProps { onSuccess?: () => void }`.
- [x] 2.2 Style `RegisterForm.tsx` to match LoginPage's Tailwind patterns — same input classes, same label style, same error banner style, same submit button style. Per-field inline errors below each input in red text.

## Phase 3: RegisterPage

- [x] 3.1 Create `src/pages/RegisterPage.tsx` — define `PageShell` as nested function matching LoginPage's pattern (min-h-screen, centered, max-w-sm, white card). Render PageShell containing heading "CBA — Student Registration", subtitle, RegisterForm with `onSuccess` navigating to `/login` with `{ state: { registered: true } }`, and "Already have an account?" link to `/login`.
- [x] 3.2 Modify `src/App.tsx` — import `RegisterPage`, add `<Route path="/register" element={<RegisterPage />} />` before the `<ProtectedRoute>` block (public route, same level as `/login`).

## Phase 4: LoginPage Update

- [x] 4.1 Modify `src/pages/LoginPage.tsx` — import `Link` from `react-router-dom`, add a "Register" link below the submit button inside the form area.

## Phase 5: Testing

- [x] 5.1 Create `src/utils/__tests__/validateRegistration.test.ts` — 16 tests covering all fields: empty required fields, valid data, CI invalid chars, short password, optional phone, invalid phone format, email format, full_name length.
- [x] 5.2 Create `src/utils/__tests__/mapAuthError.test.ts` — 7 tests: signup_disabled, duplicate email (with and without code), duplicate CI, invalid email, network error, unknown error.
- [x] 5.3 Create `src/components/organisms/__tests__/RegisterForm.test.tsx` — 7 tests: renders all fields, empty submission errors, valid submission calls signUp, duplicate email inline error, network error banner, short password validation, login link.
- [x] 5.4 Run `npm test` — 56 tests pass (8 test files). Run `npm run build` — clean build, zero TypeScript errors.
