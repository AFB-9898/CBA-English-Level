# Student Registration Specification

## Purpose

Self-service registration for new students. Frontend-only feature — Supabase Auth trigger and RLS already exist.

## Requirements

### R1: Registration Form

The system MUST render a form at `/register` with five labeled REQUIRED inputs: full_name, CI, email, phone, password.

#### G1: Form renders

- GIVEN a user navigates to `/register`
- WHEN the page loads
- THEN five input fields and a "Register" button are visible

#### G2: Empty submission blocked

- GIVEN the form is empty
- WHEN the user clicks Register
- THEN inline validation errors appear for each empty field

### R2: Client-Side Validation

The system MUST validate before submission: full_name non-empty, CI is 3–20 characters (alphanumeric + spaces + hyphens), email valid format, password ≥ 8 chars.

#### G3: Valid submission

- GIVEN all fields contain valid data
- WHEN the user clicks Register
- THEN the form submits to Supabase Auth

#### G4: Invalid CI rejected

- GIVEN CI contains "@@invalid@@"
- WHEN the user clicks Register
- THEN error appears: "CI contains invalid characters"
- AND form does NOT submit

#### G5: Short password rejected

- GIVEN password is "1234567" (7 chars)
- WHEN the user clicks Register
- THEN error appears: "Password must be at least 8 characters"
- AND form does NOT submit

### R3: Supabase Sign Up

The system MUST call `supabase.auth.signUp({ email, password, options: { data: { ci, full_name, phone } } })`. The existing trigger handles student row creation.

#### G6: Successful sign up

- GIVEN valid, non-duplicate data is submitted
- WHEN signUp resolves successfully
- THEN user is redirected to `/login` with a success message

### R4: Duplicate Error Handling

The system MUST map Supabase errors to friendly messages. Duplicate email → "This email is already registered." Duplicate CI → "This CI is already registered."

#### G7: Duplicate email

- GIVEN a user submits an email already in Supabase Auth
- WHEN signUp returns a duplicate-email error
- THEN inline error under email: "This email is already registered"
- AND form remains editable

#### G8: Duplicate CI

- GIVEN a user submits a CI already in the student table
- WHEN signUp returns a duplicate-CI error
- THEN inline error under CI: "This CI is already registered"
- AND form remains editable

### R5: Network Error Handling

The system MUST display a user-friendly message on network or server failure.

#### G9: Network failure

- GIVEN user submits valid data
- WHEN the Supabase request fails
- THEN message appears: "Network error. Please try again."
- AND form remains editable

### R6: Navigation Links

LoginPage MUST show a "Register" link. RegisterPage MUST show an "Already have an account?" link.

#### G10: Login → Register

- GIVEN user is on `/login`
- WHEN user clicks "Register"
- THEN navigates to `/register`

#### G11: Register → Login

- GIVEN user is on `/register`
- WHEN user clicks "Already have an account?"
- THEN navigates to `/login`

### R7: Responsive Layout

The system MUST render mobile-first, functional at 320px, matching LoginPage's style.

#### G12: Mobile rendering

- GIVEN user opens `/register` at 320px width
- WHEN the page renders
- THEN all fields and button are visible without horizontal scroll
