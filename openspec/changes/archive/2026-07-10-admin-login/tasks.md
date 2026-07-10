# Tasks: Admin Login

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

## Phase 1: Dependencies & Config

- [x] 1.1 Install `react-router-dom` via npm → `package.json` updated, `node_modules/` refreshed
- [x] 1.2 Create `src/types/auth.ts` — export `AuthContextValue` interface (user, session, loading, isAdmin, login, logout) per design.md contract

## Phase 2: Auth Layer

- [x] 2.1 Create `src/components/auth/AuthContext.tsx` — `AuthProvider` with `getSession()`, `onAuthStateChange` listener, `login(email, pw)` calling `signInWithPassword`, `logout()` calling `signOut`, role check via `user_metadata.role === 'admin'`. Loading state resolves after initial session check
- [x] 2.2 Create `src/components/auth/__tests__/AuthContext.test.tsx` — test: renders children, `useAuth()` returns `loading: true` initially, resolves to `user`/`isAdmin` after session fetch, `login()` calls Supabase, `logout()` calls signOut
- [x] 2.3 Create `src/components/auth/ProtectedRoute.tsx` — reads `useAuth()`: if loading → spinner, if `!user` → `<Navigate to="/login" />`, if `!isAdmin` → `<Navigate to="/login" />`, else → `<Outlet />`
- [x] 2.4 Create `src/components/auth/__tests__/ProtectedRoute.test.tsx` — test: redirects to `/login` when `user: null`, redirects when `isAdmin: false`, renders `<Outlet>` when admin

## Phase 3: Pages

- [x] 3.1 Create `src/pages/LoginPage.tsx` — email/password controlled form, calls `login()` from context on submit, displays inline error on failure, shows loading state on button during submit, redirects already-admin to `/admin` (R7)
- [x] 3.2 Create `src/pages/__tests__/LoginPage.test.tsx` — test: renders form fields, displays error on failed login, calls `login()` on submit, redirects when already authenticated
- [x] 3.3 Create `src/pages/AdminLayout.tsx` — shell with header, app title, logout button calling `logout()` from context, renders `<Outlet />` for nested routes
- [x] 3.4 Create `src/pages/__tests__/AdminLayout.test.tsx` — test: renders title and logout button, logout calls `logout()` from context

## Phase 4: Integration

- [x] 4.1 Modify `src/App.tsx` — wrap app in `<BrowserRouter>` + `<AuthProvider>`, define routes: `/login` → `LoginPage`, `/admin` → `ProtectedRoute` layout with `AdminLayout` inside. Placeholder child route under `/admin` for future content
- [x] 4.2 Create `src/__tests__/App.test.tsx` — test: renders login page at `/login`, redirects unauthenticated to `/login` when visiting `/admin`, renders admin layout for authenticated admin

## Phase 5: Polish & Verification

- [x] 5.1 Run `npm run build` — verify zero TypeScript errors and clean Vite build
- [x] 5.2 Run `npm test` — verify all new tests pass
- [x] 5.3 Manual smoke test: start dev server, navigate to `/admin` → redirects to `/login`, log in as admin → redirects to `/admin`, click logout → back to `/login`
