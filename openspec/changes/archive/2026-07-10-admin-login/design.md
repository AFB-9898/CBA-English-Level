# Design: Admin Login

## Technical Approach

Client-side auth flow using Supabase Auth SDK (`signInWithPassword`, `onAuthStateChange`, `signOut`) wrapped in a React Context (`AuthProvider`). Routing via `react-router-dom` v7 with nested routes and a `ProtectedRoute` guard. No backend changes — Supabase Auth is already configured; admin role lives in `user_metadata.role`.

## Architecture Decisions

### Decision: Auth state via React Context (not URL-based or state library)

**Choice**: React Context + `useAuth()` hook
**Alternatives considered**: URL query params, Zustand/Redux store
**Rationale**: Auth state is fundamentally cross-cutting UI state. Context is the idiomatic React pattern, avoids extra dependencies, and matches the project's lightweight stack. A state library would be overkill for session/role data.

### Decision: Role check in `user_metadata` (not a separate table)

**Choice**: Read `user?.user_metadata?.role === 'admin'`
**Alternatives considered**: Separate `admin_roles` table with RLS join
**Rationale**: Supabase Auth already stores metadata per user. A separate table adds a query round-trip on every protected route. For this system (single admin role, few admins), metadata is sufficient. If roles expand later, migrate to a table — the `AuthProvider` abstraction makes this swap transparent.

### Decision: Route guard in component, not in route config

**Choice**: `<ProtectedRoute>` as layout element that conditionally renders `<Outlet />`
**Alternatives considered**: Wrapper HOC, route-level `loader` in react-router
**Rationale**: Layout route with `<Outlet />` is the react-router v7 recommended pattern. It keeps auth logic composable and avoids route config coupling. Adding/removing protection is a single JSX change.

## Data Flow

    ┌─────────────────────────────────────────────────┐
    │                  App mounts                     │
    │                                                 │
    │  AuthProvider                                   │
    │    ├─ getSession() → sets user/session          │
    │    ├─ loading = false                           │
    │    └─ onAuthStateChange → updates on change     │
    │                                                 │
    │  ProtectedRoute                                 │
    │    ├─ loading? → spinner                        │
    │    ├─ !user → <Navigate to="/login" />          │
    │    ├─ !isAdmin → <Navigate to="/login" />       │
    │    └─ else → <Outlet />                         │
    └─────────────────────────────────────────────────┘

**Login flow**: Form submit → `login(email, pw)` → Supabase `signInWithPassword` → `onAuthStateChange` fires → `AuthProvider` updates state → `ProtectedRoute` re-evaluates → redirect to `/admin`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/auth/AuthContext.tsx` | Create | `AuthProvider` + `useAuth()` hook — session init, login, logout, role check |
| `src/components/auth/ProtectedRoute.tsx` | Create | Route guard — loading state, auth check, role check, redirect |
| `src/pages/LoginPage.tsx` | Create | Login form — email/password inputs, error display, submit handler |
| `src/pages/AdminLayout.tsx` | Create | Admin shell — header, logout button, `<Outlet />` |
| `src/App.tsx` | Modify | Wrap in `<BrowserRouter>` + `<AuthProvider>`, define route tree |
| `package.json` | Modify | Add `react-router-dom` dependency |

## Interfaces / Contracts

```ts
// AuthContext contract
interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
}

// useAuth() throws if used outside AuthProvider
function useAuth(): AuthContextValue

// AuthProvider props
interface AuthProviderProps {
  children: React.ReactNode
}
```

```ts
// ProtectedRoute — no props, reads from context
// Returns <Outlet /> if authorized, <Navigate /> otherwise
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `useAuth()` hook returns correct state | Render `useAuth()` inside mock `AuthProvider` |
| Unit | `ProtectedRoute` redirects when unauthenticated | Mock context with `user: null`, assert `<Navigate>` |
| Unit | `ProtectedRoute` redirects when non-admin | Mock context with `user` but `isAdmin: false` |
| Unit | `LoginPage` renders form and handles submit | Render form, mock `login()`, assert calls |
| Unit | `LoginPage` displays error on failed login | Mock `login()` returning `{ error: "..." }` |
| Integration | Full login flow (form → context → redirect) | Mock Supabase client, render full route tree |

**Mock strategy**: Create `__mocks__/supabase.ts` that returns a configurable mock client. Each test provides specific `signInWithPassword` / `getSession` / `onAuthStateChange` behavior.

## Migration / Rollout

No migration required. This adds client-side auth only. The admin user (`admin@cba.edu.bo` with `role: 'admin'` in `user_metadata`) already exists in Supabase Auth.

## Open Questions

None — proposal fully scoped, codebase is empty placeholder, Supabase client confirmed working.
