/// <reference types="vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QuestionOptionList } from '../QuestionOptionList'

// Mock useTranslation to return the key as value
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'questions.form.options': 'Opciones',
        'questions.form.addOption': 'Agregar opción',
        'questions.form.correctAnswer': 'Respuesta correcta',
        'questions.form.removeOption': 'Eliminar opción',
      }
      return map[key] ?? key
    },
  }),
}))

const baseProps = {
  errors: {} as Record<string, string>,
  disabled: false,
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  onUpdateText: vi.fn(),
  onSelectCorrect: vi.fn(),
}

const makeOptions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ text: `Option ${i + 1}`, is_correct: i === 0 }))

describe('QuestionOptionList', () => {
  it('renders N options with radio + text inputs', () => {
    const options = makeOptions(4)
    render(<QuestionOptionList {...baseProps} options={options} />)
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
  })

  it('click add calls onAdd', () => {
    render(<QuestionOptionList {...baseProps} options={makeOptions(4)} />)
    const addBtn = screen.getByText(/Agregar opción/i)
    fireEvent.click(addBtn)
    expect(baseProps.onAdd).toHaveBeenCalled()
  })

  it('click remove calls onRemove with index', () => {
    render(<QuestionOptionList {...baseProps} options={makeOptions(5)} />)
    const removeBtns = screen.getAllByText('✕')
    fireEvent.click(removeBtns[1])
    expect(baseProps.onRemove).toHaveBeenCalledWith(1)
  })

  it('typing text calls onUpdateText with index and value', () => {
    render(<QuestionOptionList {...baseProps} options={makeOptions(4)} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[2], { target: { value: 'New text' } })
    expect(baseProps.onUpdateText).toHaveBeenCalledWith(2, 'New text')
  })

  it('click radio calls onSelectCorrect with index', () => {
    render(<QuestionOptionList {...baseProps} options={makeOptions(4)} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[3])
    expect(baseProps.onSelectCorrect).toHaveBeenCalledWith(3)
  })

  it('shows validation error for options/correct group', () => {
    const errors = { options: 'At least 4 options are required' }
    render(<QuestionOptionList {...baseProps} options={makeOptions(4)} errors={errors} />)
    expect(screen.getByRole('alert')).toHaveTextContent('At least 4 options are required')
  })

  it('applies red border class when per-option error exists', () => {
    const errors = { option_1: 'Option text is required' }
    render(<QuestionOptionList {...baseProps} options={makeOptions(4)} errors={errors} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs[1].className).toContain('border-red-400')
  })

  it('disabled state disables all inputs', () => {
    render(<QuestionOptionList {...baseProps} options={makeOptions(4)} disabled />)
    const inputs = screen.getAllByRole('textbox')
    inputs.forEach((input) => expect(input).toBeDisabled())
    const radios = screen.getAllByRole('radio')
    radios.forEach((radio) => expect(radio).toBeDisabled())
  })

  it('hides remove button when 4 options (min)', () => {
    render(<QuestionOptionList {...baseProps} options={makeOptions(4)} />)
    expect(screen.queryByText('✕')).not.toBeInTheDocument()
  })

  it('shows remove button when >4 options', () => {
    render(<QuestionOptionList {...baseProps} options={makeOptions(5)} />)
    expect(screen.getAllByText('✕')).toHaveLength(5)
  })

  it('hides add button when maxReached', () => {
    render(<QuestionOptionList {...baseProps} options={makeOptions(10)} maxReached />)
    expect(screen.queryByText(/Agregar opción/i)).not.toBeInTheDocument()
  })
})
