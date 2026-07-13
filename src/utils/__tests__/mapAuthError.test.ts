import { describe, it, expect } from 'vitest'
import { mapAuthError } from '../mapAuthError'

describe('mapAuthError', () => {
  it('maps duplicate email (User already registered) to email field', () => {
    const result = mapAuthError({ message: 'User already registered' })
    expect(result.field).toBe('email')
    expect(result.message).toBe('This email is already registered')
  })

  it('maps duplicate email with code 23505 to email field', () => {
    const result = mapAuthError({
      message: 'duplicate key value violates unique constraint',
      code: '23505',
    })
    expect(result.field).toBe('email')
    expect(result.message).toBe('This email is already registered')
  })

  it('maps duplicate CI (student trigger error) to ci field', () => {
    const result = mapAuthError({
      message: 'duplicate key value violates unique constraint on table student',
      code: '23505',
    })
    expect(result.field).toBe('ci')
    expect(result.message).toBe('This CI is already registered')
  })

  it('maps signup_disabled to general banner', () => {
    const result = mapAuthError({ message: 'Signup is disabled', code: 'signup_disabled' })
    expect(result.field).toBeNull()
    expect(result.message).toBe('Registration is currently disabled')
  })

  it('maps invalid email format to email field', () => {
    const result = mapAuthError({ message: 'Invalid email', code: 'email_address_not_valid' })
    expect(result.field).toBe('email')
    expect(result.message).toBe('Invalid email format')
  })

  it('maps network/unknown errors to general banner', () => {
    const result = mapAuthError({ message: 'Failed to fetch' })
    expect(result.field).toBeNull()
    expect(result.message).toBe('Network error. Please try again.')
  })

  it('maps unknown error with no code to general banner', () => {
    const result = mapAuthError({ message: 'Something went wrong' })
    expect(result.field).toBeNull()
    expect(result.message).toBe('Network error. Please try again.')
  })
})
