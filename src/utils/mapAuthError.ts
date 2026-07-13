import type { TFunction } from 'i18next'
import type { RegistrationFields } from './validateRegistration'

export function mapAuthError(
  error: { message: string; code?: string },
  t?: TFunction,
): { field: keyof RegistrationFields | null; message: string } {
  const msg = error.message.toLowerCase()
  const tr = t || ((key: string) => key)

  // Signup disabled
  if (error.code === 'signup_disabled' || msg.includes('signup disabled')) {
    return { field: null, message: tr('errors.registrationDisabled') }
  }

  // Invalid email format from Supabase
  if (error.code === 'email_address_not_valid' || msg.includes('invalid email')) {
    return { field: 'email', message: tr('errors.emailInvalidFormat') }
  }

  // Duplicate CI — trigger PostgreSQL error (unique constraint on student.ci)
  if (msg.includes('duplicate key') && msg.includes('student')) {
    return { field: 'ci', message: tr('errors.ciAlreadyRegistered') }
  }

  // PostgreSQL unique violation — could be email or CI
  if (error.code === '23505') {
    if (msg.includes('student')) {
      return { field: 'ci', message: tr('errors.ciAlreadyRegistered') }
    }
    return { field: 'email', message: tr('errors.emailAlreadyRegistered') }
  }

  // Duplicate email — Supabase returns "User already registered"
  // This is the standard signUp error for duplicate emails (no code provided)
  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return { field: 'email', message: tr('errors.emailAlreadyRegistered') }
  }

  // Network / unknown errors
  return { field: null, message: tr('errors.networkError') }
}
