import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageSwitcher from '../LanguageSwitcher'

let currentLang = 'es'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      get language() { return currentLang },
      changeLanguage: (lang: string) => { currentLang = lang },
    },
  }),
}))

beforeEach(() => {
  currentLang = 'es'
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
})
