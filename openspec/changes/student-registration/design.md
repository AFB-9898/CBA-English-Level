# Design: Student Registration

## Technical Approach

Frontend-only feature. Create a `/register` route with a self-contained registration page and form organism. Call `supabase.auth.signUp()` directly with user metadata — the existing `on_auth_user_created` trigger handles student row creation. Follow LoginPage's PageShell pattern and controlled-input style exactly.

## Architecture Decisions

| Decision | Option A | Option B | Choice | Rationale |
|----------|----------|----------|--------|-----------|
| PageShell extraction | Extract to shared component | Duplicate as nested fn | **Duplicate nested** | LoginPage defines PageShell as a nested function. Extracting now would change a working file out of scope. RegisterPage gets its own copy; extraction can be a separate refactor. |
| Form organization | Inline in RegisterPage | Separate organism | **Separate organism** | 5 fields + validation + error mapping is too much for a page component. Keeps RegisterPage thin (PageShell + form), matching Atomic Design. First organism in the project — sets the pattern. |
| Form state | React Hook Form / Zod | Controlled useState + validate fn | **Controlled useState** | LoginPage already uses controlled useState pattern. No form library is installed. A pure `validate()` function keeps things simple and testable without new dependencies. |
| Error mapping | Inline in component | Dedicated `mapAuthError()` util | **Dedicated util** | Centralizes error logic, testable in isolation, reusable if student login is added later. Follows `src/utils/` convention. |
| Success state | URL search params (`?registered=1`) | `navigate()` state object | **Navigate state** | `useLocation().state?.registered` is standard react-router-dom. No query param parsing needed. Clears on page refresh (which is correct — one-time confirmation). |
| Route placement | Inside `<ProtectedRoute>` | Public standalone | **Public standalone** | Registration must be accessible to unauthenticated users. Route goes before ProtectedRoute in App.tsx, same level as `/login`. |

## Data Flow

```
RegisterPage (screen)
  └── PageShell (inline, matches LoginPage style)
        └── RegisterForm (organism)
              │
              ├── validate(fields) → { errors } or null
              │
              ├── supabase.auth.signUp({ email, password, options: { data: { ci, full_name, phone } } })
              │       │
              │       ├── success → navigate('/login', { state: { registered: true } })
              │       └── error   → mapAuthError(code) → setErrors({ field, message })
              │
              └── Fields: full_name, ci, email, phone, password
```

## File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `src/pages/RegisterPage.tsx` | PageShell + RegisterForm, link to `/login` |
| Create | `src/components/organisms/RegisterForm.tsx` | 5-field form, validate(), submit to Supabase |
| Create | `src/utils/mapAuthError.ts` | Supabase error code → friendly message mapper |
| Create | `src/utils/validateRegistration.ts` | Pure validation function, returns per-field errors |
| Modify | `src/App.tsx` | Add `/register` route before ProtectedRoute |
| Modify | `src/pages/LoginPage.tsx` | Add "Register" link below form |

## Validation Rules

| Field | Rules | Error message |
|-------|-------|---------------|
| `full_name` | Required, max 200 chars | "Full name is required" / "Full name is too long" |
| `ci` | Required, 3–20 chars, `/^[A-Za-z0-9 -]+$/` | "CI is required" / "CI must be 3–20 characters" / "CI contains invalid characters" |
| `email` | Required, valid format | "Email is required" / "Invalid email format" |
| `phone` | Optional, if provided: 7–15 digits `/^\d{7,15}$/` | "Phone must be 7–15 digits" |
| `password` | Required, min 8 chars | "Password is required" / "Password must be at least 8 characters" |

## Error Mapping

| Supabase error | Friendly message | Field |
|----------------|-----------------|-------|
| `signup_disabled` | "Registration is currently disabled" | General (banner) |
| `email_address_not_valid` | "Invalid email format" | email |
| Duplicate email (user already exists) | "This email is already registered" | email |
| Duplicate CI (trigger error) | "This CI is already registered" | ci |
| Network / unknown | "Network error. Please try again." | General (banner) |

Note: Supabase signUp returns `{ error, data }`. When `error` is null but `data.user` is null (some configs), treat as success (auto-confirm mode). The trigger error for duplicate CI surfaces as a PostgreSQL error via the signUp response.

## Interfaces / Contracts

```typescript
// src/utils/validateRegistration.ts
export interface RegistrationFields {
  full_name: string
  ci: string
  email: string
  phone: string
  password: string
}

export type FieldErrors = Partial<Record<keyof RegistrationFields, string>>

export function validateRegistration(fields: RegistrationFields): FieldErrors

// src/utils/mapAuthError.ts
export function mapAuthError(error: { message: string; code?: string }): {
  field: keyof RegistrationFields | null  // null = general banner
  message: string
}

// src/components/organisms/RegisterForm.tsx props
export interface RegisterFormProps {
  onSuccess?: () => void
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `validateRegistration()` | Pure function — valid/invalid cases for each field |
| Unit | `mapAuthError()` | Mock Supabase error objects → assert mapped messages |
| Integration | `RegisterForm` submit flow | Mock `supabase.auth.signUp`, render form, fill fields, assert redirect/error |

No E2E tests (no test runner beyond vitest + testing-library installed).

## Migration / Rollout

No migration required. The `on_auth_user_created` trigger and RLS policies are already deployed. This change only adds frontend pages.

## Open Questions

None — all decisions are resolved from the proposal, spec, and codebase patterns.
