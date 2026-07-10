# Proposal: Admin Login

## Intent

The system has no admin authentication flow. Admins need a login page, session handling, and protected routing to access admin-only areas (question management, exam config, reports). Without this, no admin can use the system.

## Scope

### In Scope
- Login page with email/password form (`/login` route)
- Admin session detection via `user_metadata.role === 'admin'`
- Protected route wrapper component (redirects unauthenticated users to `/login`)
- Auth state management with Supabase `onAuthStateChange` listener
- Logout functionality with redirect to `/login`
- Route structure: `/login`, `/admin/*`
- Basic error handling (wrong credentials, expired session, non-admin access)

### Out of Scope
- Student registration / self-signup
- Exam taking flow
- Dashboard content
- Question CRUD
- Level management
- Any admin page content beyond the shell

## Capabilities

> This section is the CONTRACT between proposal and specs phases.

### New Capabilities
- `admin-auth`: Login page, session management, protected routing, logout, role-based access control

### Modified Capabilities
None — this is the first capability being introduced.

## Approach

- Install `react-router-dom` for client-side routing
- Use Supabase Auth SDK: `signInWithPassword`, `onAuthStateChange`, `signOut`
- Create a React context (`AuthContext`) that wraps the app and exposes user/session/role
- `ProtectedRoute` component checks session + `user_metadata.role === 'admin'`
- Auth listener checks `auth.users.raw_user_meta_data` for `role: 'admin'`
- Login form uses controlled inputs with basic validation
- On successful login, redirect to `/admin`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | Modified | Wrap in router + AuthProvider, define routes |
| `src/components/` | New | Login form, ProtectedRoute, AuthContext |
| `src/pages/` | New | LoginPage, AdminLayout (placeholder) |
| `src/types/index.ts` | Modified | May extend types for auth state |
| `package.json` | Modified | Add react-router-dom dependency |
| `src/lib/supabase.ts` | No change | Already configured |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| react-router-dom v7 breaking changes | Low | Use stable v6 API patterns |
| Admin role not in user_metadata | Low | Verified: admin created with `role: 'admin'` in raw_user_meta_data |
| Session expiry handling | Medium | Listen to `SIGNED_OUT` and `TOKEN_REFRESHED` events |
| Race condition on auth state init | Medium | Show loading spinner until auth state resolves |

## Rollback Plan

Remove the `react-router-dom` dependency, delete new components/pages, and restore `App.tsx` to its placeholder state. No database changes to revert.

## Dependencies

- `react-router-dom` (to be installed)
- Supabase client already configured at `src/lib/supabase.ts`
- Admin user exists in Supabase Auth (`admin@cba.edu.bo`)

## Success Criteria

- [ ] Admin can log in with email/password at `/login`
- [ ] Successful login redirects to `/admin`
- [ ] Unauthenticated users are redirected to `/login`
- [ ] Non-admin users cannot access `/admin/*` routes
- [ ] Logout clears session and redirects to `/login`
- [ ] Login form shows errors for invalid credentials
- [ ] Auth state persists across page refreshes (Supabase session)
