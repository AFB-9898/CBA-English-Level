import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuestions } from '../hooks/useQuestions'
import { useLevels } from '../hooks/useLevels'
import { QuestionTableRow, QuestionCard } from '../components/molecules/QuestionRow'
import QuestionForm from '../components/organisms/QuestionForm'

const PAGE_SIZE = 10

export default function QuestionsScreen() {
  const segments = useLocation().pathname.split('/').filter(Boolean)
  const isCreate = segments.length >= 2 && segments[segments.length - 2] === 'questions' && segments[segments.length - 1] === 'new'
  const editId = segments.length >= 3 && segments[segments.length - 1] === 'edit' ? segments[segments.length - 2] : null

  const { t } = useTranslation()
  const navigate = useNavigate()

  const [levelFilter, setLevelFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { questions, total, loading, error, deleteQuestion } = useQuestions({
    levelId: levelFilter || undefined,
    category: categoryFilter || undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  const { levels, loading: levelsLoading } = useLevels()
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  if (isCreate) return <QuestionForm mode="create" />
  if (editId) return <QuestionForm mode="edit" questionId={editId} />

  const handleClearFilters = () => {
    setLevelFilter('')
    setCategoryFilter('')
    setPage(1)
  }

  const handleEdit = (id: string) => navigate(`/admin/questions/${id}/edit`)

  const handleDelete = async (id: string) => {
    const question = questions.find((q) => q.id === id)
    if (!window.confirm(`${t('questions.confirm.deleteTitle')}\n\n${question?.text ?? ''}\n\n${t('questions.confirm.deleteMessage')}`)) return
    setDeleteError(null)
    const result = await deleteQuestion(id)
    if (result.error) {
      setDeleteError(result.code === '23503' ? t('questions.errors.fkRestrict') : t('questions.errors.deleteFailed'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">{t('questions.title')}</h1>
        <button
          onClick={() => navigate('/admin/questions/new')}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('questions.newQuestion')}
        </button>
      </div>

      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm font-medium">{deleteError}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm font-medium">{t('questions.errors.fetchFailed')}</p>
          <p className="text-red-500 text-xs mt-1">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-3">
        <select
          value={levelFilter}
          onChange={(e) => { setLevelFilter(e.target.value); setPage(1) }}
          disabled={levelsLoading}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">{t('questions.form.levelRequired')}</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>{level.name}</option>
          ))}
        </select>

        <input
          type="text"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
          placeholder={t('questions.form.categoryPlaceholder')}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        {(levelFilter || categoryFilter) && (
          <button onClick={handleClearFilters} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium whitespace-nowrap">
            {t('questions.form.cancel', 'Cancel')}
          </button>
        )}
      </div>

      {loading && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {!loading && questions.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 overflow-x-auto hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">{t('questions.table.text')}</th>
                <th className="pb-2 font-medium">{t('questions.table.level')}</th>
                <th className="pb-2 font-medium">{t('questions.table.category')}</th>
                <th className="pb-2 font-medium">{t('questions.table.date')}</th>
                <th className="pb-2 font-medium">{t('questions.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <QuestionTableRow key={q.id} question={q} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && questions.length > 0 && (
        <div className="md:hidden space-y-3">
          {questions.map((q) => (
            <QuestionCard key={q.id} question={q} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {!loading && questions.length === 0 && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
          <p className="text-gray-400 text-sm">{t('questions.table.empty')}</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('questions.table.previous', 'Previous')}
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg ${p === page ? 'bg-blue-600 text-white' : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('questions.table.next', 'Next')}
          </button>
        </div>
      )}
    </div>
  )
}
