import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { validateRegistration } from '../../utils/validateRegistration'
import type { FieldErrors, RegistrationFields } from '../../utils/validateRegistration'
import { mapAuthError } from '../../utils/mapAuthError'

export interface RegisterFormProps {
  onSuccess?: () => void
}

export default function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { t } = useTranslation()
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

    const fieldErrors = validateRegistration(fields, t)
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
      const mapped = mapAuthError(error, t)
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

  const inputClass = 'cba-auth__input'

  return (
    <form onSubmit={handleSubmit} className="cba-auth__form">
      {/* Full Name */}
      <div className={`cba-auth__field${errors.full_name ? ' cba-auth__field--error' : ''}`}>
        <label htmlFor="full_name" className="cba-auth__label">
          {t('common.fullName')}
        </label>
        <input
          id="full_name"
          type="text"
          value={fields.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          placeholder={t('authPresentation.fullNamePlaceholder')}
          className={inputClass}
          disabled={submitting}
          autoComplete="name"
        />
        {errors.full_name && (
          <p className="cba-auth__field-error" role="alert">
            {errors.full_name}
          </p>
        )}
      </div>

      {/* CI */}
      <div className={`cba-auth__field${errors.ci ? ' cba-auth__field--error' : ''}`}>
        <label htmlFor="ci" className="cba-auth__label">
          {t('common.ci')}
        </label>
        <input
          id="ci"
          type="text"
          value={fields.ci}
          onChange={(e) => handleChange('ci', e.target.value)}
          placeholder={t('authPresentation.ciPlaceholder')}
          className={inputClass}
          disabled={submitting}
        />
        {errors.ci && (
          <p className="cba-auth__field-error" role="alert">
            {errors.ci}
          </p>
        )}
      </div>

      {/* Email */}
      <div className={`cba-auth__field${errors.email ? ' cba-auth__field--error' : ''}`}>
        <label htmlFor="email" className="cba-auth__label">
          {t('common.email')}
        </label>
        <input
          id="email"
          type="email"
          value={fields.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder={t('authPresentation.emailPlaceholder')}
          className={inputClass}
          disabled={submitting}
          autoComplete="email"
        />
        {errors.email && (
          <p className="cba-auth__field-error" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Phone */}
      <div className={`cba-auth__field${errors.phone ? ' cba-auth__field--error' : ''}`}>
        <label htmlFor="phone" className="cba-auth__label">
          {t('common.phone')} <span className="cba-auth__optional">({t('common.optional')})</span>
        </label>
        <input
          id="phone"
          type="tel"
          value={fields.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder={t('authPresentation.phonePlaceholder')}
          className={inputClass}
          disabled={submitting}
          autoComplete="tel"
        />
        {errors.phone && (
          <p className="cba-auth__field-error" role="alert">
            {errors.phone}
          </p>
        )}
      </div>

      {/* Password */}
      <div className={`cba-auth__field${errors.password ? ' cba-auth__field--error' : ''}`}>
        <label htmlFor="password" className="cba-auth__label">
          {t('common.password')}
        </label>
        <input
          id="password"
          type="password"
          value={fields.password}
          onChange={(e) => handleChange('password', e.target.value)}
          placeholder={t('authPresentation.passwordPlaceholder')}
          className={inputClass}
          disabled={submitting}
          autoComplete="new-password"
        />
        {errors.password && (
          <p className="cba-auth__field-error" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      {/* General / banner error */}
      {generalError && (
        <div className="cba-auth__alert" role="alert">
          {generalError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="cba-auth__button"
      >
        {submitting ? t('common.registering') : t('common.register')}
      </button>

      {/* Link to login */}
      <p className="cba-auth__footer">
        {t('registerForm.alreadyHaveAccount')}{' '}
        <Link to="/login" className="cba-auth__link">
          {t('registerForm.loginLink')}
        </Link>
      </p>
    </form>
  )
}
