export interface RegistrationFields {
  full_name: string
  ci: string
  email: string
  phone: string
  password: string
}

export type FieldErrors = Partial<Record<keyof RegistrationFields, string>>

export function validateRegistration(fields: RegistrationFields): FieldErrors {
  const errors: FieldErrors = {}

  // full_name: required, max 200 chars
  if (!fields.full_name.trim()) {
    errors.full_name = 'Full name is required'
  } else if (fields.full_name.length > 200) {
    errors.full_name = 'Full name is too long'
  }

  // ci: required, 3–20 chars, alphanumeric + spaces + hyphens
  if (!fields.ci.trim()) {
    errors.ci = 'CI is required'
  } else if (fields.ci.length < 3 || fields.ci.length > 20) {
    errors.ci = 'CI must be 3–20 characters'
  } else if (!/^[A-Za-z0-9 -]+$/.test(fields.ci)) {
    errors.ci = 'CI contains invalid characters'
  }

  // email: required, valid format
  if (!fields.email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = 'Invalid email format'
  }

  // phone: optional, 7–15 digits if provided
  if (fields.phone.trim() && !/^\d{7,15}$/.test(fields.phone.trim())) {
    errors.phone = 'Phone must be 7–15 digits'
  }

  // password: required, min 8 chars
  if (!fields.password) {
    errors.password = 'Password is required'
  } else if (fields.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  return errors
}
