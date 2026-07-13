import { describe, it, expect } from 'vitest'
import { validateRegistration, type RegistrationFields } from '../validateRegistration'

const validFields: RegistrationFields = {
  full_name: 'Juan Pérez',
  ci: '1234567',
  email: 'juan@example.com',
  phone: '71234567',
  password: 'password123',
}

describe('validateRegistration', () => {
  it('returns no errors for valid data', () => {
    const errors = validateRegistration(validFields)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns no errors when phone is empty (optional)', () => {
    const errors = validateRegistration({ ...validFields, phone: '' })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns full_name error when empty', () => {
    const errors = validateRegistration({ ...validFields, full_name: '' })
    expect(errors.full_name).toBe('Full name is required')
  })

  it('returns full_name error when over 200 chars', () => {
    const longName = 'A'.repeat(201)
    const errors = validateRegistration({ ...validFields, full_name: longName })
    expect(errors.full_name).toBe('Full name is too long')
  })

  it('returns ci error when empty', () => {
    const errors = validateRegistration({ ...validFields, ci: '' })
    expect(errors.ci).toBe('CI is required')
  })

  it('returns ci error when too short', () => {
    const errors = validateRegistration({ ...validFields, ci: '12' })
    expect(errors.ci).toBe('CI must be 3–20 characters')
  })

  it('returns ci error when too long', () => {
    const errors = validateRegistration({ ...validFields, ci: 'A'.repeat(21) })
    expect(errors.ci).toBe('CI must be 3–20 characters')
  })

  it('returns ci error for invalid characters', () => {
    const errors = validateRegistration({ ...validFields, ci: '@@invalid@@' })
    expect(errors.ci).toBe('CI contains invalid characters')
  })

  it('accepts CI with spaces and hyphens', () => {
    const errors = validateRegistration({ ...validFields, ci: 'AB-12 34' })
    expect(errors.ci).toBeUndefined()
  })

  it('returns email error when empty', () => {
    const errors = validateRegistration({ ...validFields, email: '' })
    expect(errors.email).toBe('Email is required')
  })

  it('returns email error for invalid format', () => {
    const errors = validateRegistration({ ...validFields, email: 'not-an-email' })
    expect(errors.email).toBe('Invalid email format')
  })

  it('returns password error when empty', () => {
    const errors = validateRegistration({ ...validFields, password: '' })
    expect(errors.password).toBe('Password is required')
  })

  it('returns password error when too short', () => {
    const errors = validateRegistration({ ...validFields, password: '1234567' })
    expect(errors.password).toBe('Password must be at least 8 characters')
  })

  it('returns phone error for invalid format', () => {
    const errors = validateRegistration({ ...validFields, phone: '123' })
    expect(errors.phone).toBe('Phone must be 7–15 digits')
  })

  it('returns phone error for non-numeric input', () => {
    const errors = validateRegistration({ ...validFields, phone: 'abcdefg' })
    expect(errors.phone).toBe('Phone must be 7–15 digits')
  })

  it('returns multiple errors for multiple invalid fields', () => {
    const errors = validateRegistration({
      full_name: '',
      ci: '@',
      email: 'bad',
      phone: '123',
      password: 'short',
    })
    expect(errors.full_name).toBeDefined()
    expect(errors.ci).toBeDefined()
    expect(errors.email).toBeDefined()
    expect(errors.phone).toBeDefined()
    expect(errors.password).toBeDefined()
  })
})
