import type { RegistrationFields } from './validateRegistration'

export function mapAuthError(error: {
  message: string
  code?: string
}): { field: keyof RegistrationFields | null; message: string } {
  const msg = error.message.toLowerCase()

  // Signup disabled
  if (error.code === 'signup_disabled' || msg.includes('signup disabled')) {
    return { field: null, message: 'Registration is currently disabled' }
  }

  // Invalid email format from Supabase
  if (error.code === 'email_address_not_valid' || msg.includes('invalid email')) {
    return { field: 'email', message: 'Invalid email format' }
  }

  // Duplicate CI — trigger PostgreSQL error (unique constraint on student.ci)
  if (msg.includes('duplicate key') && msg.includes('student')) {
    return { field: 'ci', message: 'This CI is already registered' }
  }

  // PostgreSQL unique violation — could be email or CI
  if (error.code === '23505') {
    if (msg.includes('student')) {
      return { field: 'ci', message: 'This CI is already registered' }
    }
    return { field: 'email', message: 'This email is already registered' }
  }

  // Duplicate email — Supabase returns "User already registered"
  // This is the standard signUp error for duplicate emails (no code provided)
  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return { field: 'email', message: 'This email is already registered' }
  }

  // Network / unknown errors
  return { field: null, message: 'Network error. Please try again.' }
}
