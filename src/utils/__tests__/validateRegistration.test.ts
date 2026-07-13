import { describe, it, expect } from 'vitest'
import { validateRegistration, type RegistrationFields } from '../validateRegistration'
import i18n from '../../i18n'

const t = i18n.t

const validFields: RegistrationFields = {
  full_name: 'Juan Pérez',
  ci: '1234567',
  email: 'juan@example.com',
  phone: '71234567',
  password: 'password123',
}

describe('validateRegistration', () => {
  it('returns no errors for valid data', () => {
    const errors = validateRegistration(validFields, t)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns no errors when phone is empty (optional)', () => {
    const errors = validateRegistration({ ...validFields, phone: '' }, t)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns full_name error when empty', () => {
    const errors = validateRegistration({ ...validFields, full_name: '' }, t)
    expect(errors.full_name).toBe(t('validation.fullNameRequired'))
  })

  it('returns full_name error when over 200 chars', () => {
    const longName = 'A'.repeat(201)
    const errors = validateRegistration({ ...validFields, full_name: longName }, t)
    expect(errors.full_name).toBe(t('validation.fullNameTooLong'))
  })

  it('returns ci error when empty', () => {
    const errors = validateRegistration({ ...validFields, ci: '' }, t)
    expect(errors.ci).toBe(t('validation.ciRequired'))
  })

  it('returns ci error when too short', () => {
    const errors = validateRegistration({ ...validFields, ci: '12' }, t)
    expect(errors.ci).toBe(t('validation.ciLength'))
  })

  it('returns ci error when too long', () => {
    const errors = validateRegistration({ ...validFields, ci: 'A'.repeat(21) }, t)
    expect(errors.ci).toBe(t('validation.ciLength'))
  })

  it('returns ci error for invalid characters', () => {
    const errors = validateRegistration({ ...validFields, ci: '@@invalid@@' }, t)
    expect(errors.ci).toBe(t('validation.ciInvalid'))
  })

  it('accepts CI with spaces and hyphens', () => {
    const errors = validateRegistration({ ...validFields, ci: 'AB-12 34' }, t)
    expect(errors.ci).toBeUndefined()
  })

  it('returns email error when empty', () => {
    const errors = validateRegistration({ ...validFields, email: '' }, t)
    expect(errors.email).toBe(t('validation.emailRequired'))
  })

  it('returns email error for invalid format', () => {
    const errors = validateRegistration({ ...validFields, email: 'not-an-email' }, t)
    expect(errors.email).toBe(t('validation.emailInvalid'))
  })

  it('returns password error when empty', () => {
    const errors = validateRegistration({ ...validFields, password: '' }, t)
    expect(errors.password).toBe(t('validation.passwordRequired'))
  })

  it('returns password error when too short', () => {
    const errors = validateRegistration({ ...validFields, password: '1234567' }, t)
    expect(errors.password).toBe(t('validation.passwordTooShort'))
  })

  it('returns phone error for invalid format', () => {
    const errors = validateRegistration({ ...validFields, phone: '123' }, t)
    expect(errors.phone).toBe(t('validation.phoneInvalid'))
  })

  it('returns phone error for non-numeric input', () => {
    const errors = validateRegistration({ ...validFields, phone: 'abcdefg' }, t)
    expect(errors.phone).toBe(t('validation.phoneInvalid'))
  })

  it('returns multiple errors for multiple invalid fields', () => {
    const errors = validateRegistration({
      full_name: '',
      ci: '@',
      email: 'bad',
      phone: '123',
      password: 'short',
    }, t)
    expect(errors.full_name).toBeDefined()
    expect(errors.ci).toBeDefined()
    expect(errors.email).toBeDefined()
    expect(errors.phone).toBeDefined()
    expect(errors.password).toBeDefined()
  })
})
