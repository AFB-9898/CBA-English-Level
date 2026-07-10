# Admin Auth Specification

## Purpose

Defines the admin authentication and authorization flow for the CBA placement exam system. Covers login, session management, role-based access control, protected routing, and logout. This is the foundational security layer for all admin functionality.

---

## Requirements

### Requirement: R1 — Login Page

The system MUST provide a `/login` route with a form accepting email and password. On submit, the form SHALL call `supabase.auth.signInWithPassword()` with the provided credentials.

#### Scenario: G1 — Admin logs in with valid credentials

- GIVEN an admin user with valid email and password exists in Supabase Auth
- WHEN the user submits the login form at `/login`
- THEN the system calls `signInWithPassword()` with the credentials
- AND upon success, the user is redirected to `/admin`

#### Scenario: G2 — Admin logs in with wrong password

- GIVEN an admin user with a valid email but incorrect password
- WHEN the user submits the login form at `/login`
- THEN an inline error message is displayed: "Invalid email or password"
- AND the user remains on `/login`

### Requirement: R2 — Admin Detection

After a successful login, the system MUST check `user_metadata.role === 'admin'`. If the role is not `'admin'`, the system SHALL immediately call `signOut()` and display an access-denied error.

#### Scenario: G3 — Student tries to access admin area

- GIVEN a non-admin user (role is not `'admin'`) logs in with valid credentials
- WHEN the auth state resolves after login
- THEN the system detects the missing admin role
- AND calls `signOut()` to clear the session
- AND displays an error: "Access denied: not an admin"
- AND the user remains on `/login`

### Requirement: R3 — Protected Routes

All `/admin/*` routes MUST be protected. The system SHALL redirect unauthenticated users to `/login`. If a session exists but the user is not an admin, the system SHALL redirect to `/login` with an error message.

#### Scenario: G4 — Unauthenticated user visits /admin

- GIVEN no active session exists
- WHEN a user navigates to any `/admin/*` route
- THEN the user is redirected to `/login`
- AND the original destination is not accessible

#### Scenario: G7 — Expired session

- GIVEN a session has expired (Supabase refresh token invalid)
- WHEN the user navigates to any `/admin/*` route
- THEN the user is redirected to `/login`
- AND an appropriate session-expired message is shown

### Requirement: R4 — Auth State

The system MUST listen to `onAuthStateChange` from the Supabase client. Session state SHALL persist across page refreshes. The system MUST show a loading indicator while resolving the initial auth state to prevent race conditions.

#### Scenario: G6 — Page refresh while logged in

- GIVEN an admin user has an active session
- WHEN the browser page is refreshed on any `/admin/*` route
- THEN the auth state is restored from the Supabase session
- AND the user remains on the current admin route
- AND no redirect to `/login` occurs

#### Scenario: Initial auth state resolution

- GIVEN the application loads for the first time or after a refresh
- WHEN the auth state has not yet resolved
- THEN a loading spinner is displayed
- AND no routes are rendered until auth state is determined

### Requirement: R5 — Logout

The system MUST provide a logout action that calls `signOut()` from the Supabase client. After logout, the session SHALL be cleared and the user redirected to `/login`.

#### Scenario: G5 — Admin clicks logout

- GIVEN an admin user is authenticated and on an admin route
- WHEN the user triggers the logout action
- THEN `signOut()` is called
- AND the session is cleared
- AND the user is redirected to `/login`

### Requirement: R6 — Error Handling

The system SHALL display inline error messages for: wrong credentials (R1), missing admin role (R2), network errors, and expired sessions (R3). Errors MUST NOT be exposed as unhandled promise rejections or console-only.

#### Scenario: Network error during login

- GIVEN the Supabase backend is unreachable
- WHEN the user submits the login form
- THEN an inline error is displayed: "Network error. Please try again."
- AND the user remains on `/login`

### Requirement: R7 — Already Logged In Redirect

If a user is already authenticated as admin and navigates to `/login`, the system MUST redirect them to `/admin`. This prevents authenticated admins from seeing the login form.

#### Scenario: Authenticated admin visits /login

- GIVEN an admin user is authenticated
- WHEN the user navigates to `/login`
- THEN the user is redirected to `/admin`
- AND the login form is not rendered

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Auth state resolution time | < 500ms on warm cache |
| Login form responsiveness | Works on mobile (320px+ width) |
| Loading state | Spinner shown within 100ms of app mount |
| Error visibility | Inline errors visible without scrolling |
