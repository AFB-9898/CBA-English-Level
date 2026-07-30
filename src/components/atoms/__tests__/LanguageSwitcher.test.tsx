import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageSwitcher from '../LanguageSwitcher'

let currentLang = 'es'
let changedLanguage: string | undefined

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      get language() { return currentLang },
      changeLanguage: (lang: string) => {
        changedLanguage = lang
        currentLang = lang
      },
    },
  }),
}))

beforeEach(() => {
  currentLang = 'es'
  changedLanguage = undefined
})

describe('LanguageSwitcher', () => {
  it('shows ES as current language when browser is in Spanish', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByText('ES')).toBeInTheDocument()
  })

  it('toggles language on click', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<LanguageSwitcher />)

    await user.click(screen.getByText('ES'))
    rerender(<LanguageSwitcher />)

    expect(screen.getByText('EN')).toBeInTheDocument()
  })

  it.each([
    ['es-BO', 'ES', 'en'],
    ['en-US', 'EN', 'es'],
  ])('switches %s to %s', async (locale, label, nextLanguage) => {
    currentLang = locale
    const user = userEvent.setup()

    render(<LanguageSwitcher />)
    await user.click(screen.getByRole('button', { name: label }))

    expect(changedLanguage).toBe(nextLanguage)
  })
})
