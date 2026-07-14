import { useTranslation } from 'react-i18next'
import type { QuestionOptionFormData } from '../../types'

interface QuestionOptionListProps {
  options: QuestionOptionFormData[]
  errors: Record<string, string>
  disabled: boolean
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdateText: (index: number, value: string) => void
  onSelectCorrect: (index: number) => void
  maxReached?: boolean
}

export function QuestionOptionList({
  options, errors, disabled, onAdd, onRemove, onUpdateText, onSelectCorrect, maxReached,
}: QuestionOptionListProps) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">{t('questions.form.options')} *</label>
        {!maxReached && (
          <button type="button" onClick={onAdd} disabled={disabled}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
            + {t('questions.form.addOption')}
          </button>
        )}
      </div>
      {(errors.options || errors.correct) && (
        <p className="text-red-500 text-sm mb-2" role="alert">{errors.options || errors.correct}</p>
      )}
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="correct-answer" checked={opt.is_correct}
              onChange={() => onSelectCorrect(i)} disabled={disabled}
              aria-label={`${t('questions.form.correctAnswer')} ${i + 1}`} className="shrink-0" />
            <input type="text" value={opt.text} onChange={(e) => onUpdateText(i, e.target.value)}
              placeholder={`${t('questions.form.options')} ${i + 1}`} disabled={disabled}
              className={`flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[`option_${i}`] ? 'border-red-400' : 'border-gray-300'}`} />
            {options.length > 4 && (
              <button type="button" onClick={() => onRemove(i)} disabled={disabled}
                className="text-red-500 hover:text-red-700 text-sm font-medium shrink-0 disabled:opacity-50"
                aria-label={`${t('questions.form.removeOption')} ${i + 1}`}>✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default QuestionOptionList
