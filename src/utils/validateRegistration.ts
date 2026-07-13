import type { TFunction } from 'i18next'

export interface RegistrationFields {
  full_name: string
  ci: string
  email: string
  phone: string
  password: string
}

export type FieldErrors = Partial<Record<keyof RegistrationFields, string>>

export function validateRegistration(
  fields: RegistrationFields,
  t?: TFunction,
): FieldErrors {
  const errors: FieldErrors = {}
  const msg = t || ((key: string) => key)

  // full_name: required, max 200 chars
  if (!fields.full_name.trim()) {
    errors.full_name = msg('validation.fullNameRequired')
  } else if (fields.full_name.length > 200) {
    errors.full_name = msg('validation.fullNameTooLong')
  }

  // ci: required, 3–20 chars, alphanumeric + spaces + hyphens
  if (!fields.ci.trim()) {
    errors.ci = msg('validation.ciRequired')
  } else if (fields.ci.length < 3 || fields.ci.length > 20) {
    errors.ci = msg('validation.ciLength')
  } else if (!/^[A-Za-z0-9 -]+$/.test(fields.ci)) {
    errors.ci = msg('validation.ciInvalid')
  }

  // email: required, valid format
  if (!fields.email.trim()) {
    errors.email = msg('validation.emailRequired')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = msg('validation.emailInvalid')
  }

  // phone: optional, 7–15 digits if provided
  if (fields.phone.trim() && !/^\d{7,15}$/.test(fields.phone.trim())) {
    errors.phone = msg('validation.phoneInvalid')
  }

  // password: required, min 8 chars
  if (!fields.password) {
    errors.password = msg('validation.passwordRequired')
  } else if (fields.password.length < 8) {
    errors.password = msg('validation.passwordTooShort')
  }

  return errors
}
