import { useTranslation } from 'react-i18next'
import type { QuestionWithLevel } from '../../types'

interface QuestionRowProps {
  question: QuestionWithLevel
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

/** Desktop: table row variant. Use inside <table><tbody>. */
export function QuestionTableRow({ question, onEdit, onDelete }: QuestionRowProps) {
  const { t } = useTranslation()

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2.5 text-gray-900 max-w-xs truncate">{question.text}</td>
      <td className="py-2.5 text-gray-700">{question.level?.name ?? '—'}</td>
      <td className="py-2.5 text-gray-500">{question.category ?? '—'}</td>
      <td className="py-2.5 text-gray-500">
        {new Date(question.created_at).toLocaleDateString()}
      </td>
      <td className="py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(question.id)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {t('questions.table.edit', 'Edit')}
          </button>
          <button
            onClick={() => onDelete(question.id)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            {t('questions.table.delete', 'Delete')}
          </button>
        </div>
      </td>
    </tr>
  )
}

/** Mobile: card variant. Use outside <table>. */
export function QuestionCard({ question, onEdit, onDelete }: QuestionRowProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
      <p className="text-sm font-medium text-gray-900 line-clamp-2">{question.text}</p>
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 font-medium text-gray-700">
          {question.level?.name ?? '—'}
        </span>
        {question.category && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 font-medium text-blue-700">
            {question.category}
          </span>
        )}
        <span>{new Date(question.created_at).toLocaleDateString()}</span>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => onEdit(question.id)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {t('questions.table.edit', 'Edit')}
        </button>
        <button
          onClick={() => onDelete(question.id)}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          {t('questions.table.delete', 'Delete')}
        </button>
      </div>
    </div>
  )
}

/** Default export for backwards compat — renders table row. */
export default QuestionTableRow
