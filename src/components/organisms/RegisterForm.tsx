import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { validateRegistration } from '../../utils/validateRegistration'
import type { FieldErrors, RegistrationFields } from '../../utils/validateRegistration'
import { mapAuthError } from '../../utils/mapAuthError'

export interface RegisterFormProps {
  onSuccess?: () => void
}

export default function RegisterForm({ onSuccess }: RegisterFormProps) {
  const navigate = useNavigate()
  const [fields, setFields] = useState<RegistrationFields>({
    full_name: '',
    ci: '',
    email: '',
    phone: '',
    password: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleChange(field: keyof RegistrationFields, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }))
    // Clear per-field error on edit
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGeneralError(null)

    const fieldErrors = validateRegistration(fields)
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)

    const { error } = await supabase.auth.signUp({
      email: fields.email,
      password: fields.password,
      options: {
        data: {
          ci: fields.ci,
          full_name: fields.full_name,
          phone: fields.phone,
        },
      },
    })

    setSubmitting(false)

    if (error) {
      const mapped = mapAuthError(error)
      if (mapped.field) {
        setErrors({ [mapped.field]: mapped.message })
      } else {
        setGeneralError(mapped.message)
      }
      return
    }

    // Success — navigate to login with confirmation state
    if (onSuccess) {
      onSuccess()
    } else {
      navigate('/login', { state: { registered: true } })
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Full Name */}
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
          Full Name
        </label>
        <input
          id="full_name"
          type="text"
          value={fields.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          placeholder="Juan Pérez"
          className={inputClass}
          disabled={submitting}
          autoComplete="name"
        />
        {errors.full_name && (
          <p className="text-red-500 text-sm mt-1" role="alert">
            {errors.full_name}
          </p>
        )}
      </div>

      {/* CI */}
      <div>
        <label htmlFor="ci" className="block text-sm font-medium text-gray-700 mb-1">
          CI (Identity Card)
        </label>
        <input
          id="ci"
          type="text"
          value={fields.ci}
          onChange={(e) => handleChange('ci', e.target.value)}
          placeholder="1234567"
          className={inputClass}
          disabled={submitting}
        />
        {errors.ci && (
          <p className="text-red-500 text-sm mt-1" role="alert">
            {errors.ci}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={fields.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="student@cba.edu.bo"
          className={inputClass}
          disabled={submitting}
          autoComplete="email"
        />
        {errors.email && (
          <p className="text-red-500 text-sm mt-1" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          value={fields.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="71234567"
          className={inputClass}
          disabled={submitting}
          autoComplete="tel"
        />
        {errors.phone && (
          <p className="text-red-500 text-sm mt-1" role="alert">
            {errors.phone}
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={fields.password}
          onChange={(e) => handleChange('password', e.target.value)}
          placeholder="••••••••"
          className={inputClass}
          disabled={submitting}
          autoComplete="new-password"
        />
        {errors.password && (
          <p className="text-red-500 text-sm mt-1" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      {/* General / banner error */}
      {generalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm" role="alert">
          {generalError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Registering…' : 'Register'}
      </button>

      {/* Link to login */}
      <p className="text-sm text-center text-gray-500 mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 hover:underline">
          Login
        </Link>
      </p>
    </form>
  )
}
