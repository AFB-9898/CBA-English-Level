import { describe, it, expect } from 'vitest'
import { mapAuthError } from '../mapAuthError'
import i18n from '../../i18n'

const t = i18n.t

describe('mapAuthError', () => {
  it('maps duplicate email (User already registered) to email field', () => {
    const result = mapAuthError({ message: 'User already registered' }, t)
    expect(result.field).toBe('email')
    expect(result.message).toBe(t('errors.emailAlreadyRegistered'))
  })

  it('maps duplicate email with code 23505 to email field', () => {
    const result = mapAuthError({
      message: 'duplicate key value violates unique constraint',
      code: '23505',
    }, t)
    expect(result.field).toBe('email')
    expect(result.message).toBe(t('errors.emailAlreadyRegistered'))
  })

  it('maps duplicate CI (student trigger error) to ci field', () => {
    const result = mapAuthError({
      message: 'duplicate key value violates unique constraint on table student',
      code: '23505',
    }, t)
    expect(result.field).toBe('ci')
    expect(result.message).toBe(t('errors.ciAlreadyRegistered'))
  })

  it('maps signup_disabled to general banner', () => {
    const result = mapAuthError({ message: 'Signup is disabled', code: 'signup_disabled' }, t)
    expect(result.field).toBeNull()
    expect(result.message).toBe(t('errors.registrationDisabled'))
  })

  it('maps invalid email format to email field', () => {
    const result = mapAuthError({ message: 'Invalid email', code: 'email_address_not_valid' }, t)
    expect(result.field).toBe('email')
    expect(result.message).toBe(t('errors.emailInvalidFormat'))
  })

  it('maps network/unknown errors to general banner', () => {
    const result = mapAuthError({ message: 'Failed to fetch' }, t)
    expect(result.field).toBeNull()
    expect(result.message).toBe(t('errors.networkError'))
  })

  it('maps unknown error with no code to general banner', () => {
    const result = mapAuthError({ message: 'Something went wrong' }, t)
    expect(result.field).toBeNull()
    expect(result.message).toBe(t('errors.networkError'))
  })
})
