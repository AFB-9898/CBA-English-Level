import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuestionForm } from '../../hooks/useQuestionForm'
import { QuestionOptionList } from '../molecules/QuestionOptionList'

interface QuestionFormProps {
  mode: 'create' | 'edit'
  questionId?: string
}

export default function QuestionForm({ mode, questionId }: QuestionFormProps) {
  const { t } = useTranslation()
  const {
    text, setText, levelId, setLevelId, category, setCategory,
    options, fieldErrors, generalError, submitting, loadingQuestion, notFound,
    levels, levelsLoading,
    addOption, removeOption, updateOptionText, selectCorrect, handleSubmit,
  } = useQuestionForm(mode, questionId)

  if (loadingQuestion) return <p className="text-gray-500 text-sm">{t('questions.form.loadingQuestion')}</p>
  if (notFound) return <p className="text-red-500 text-sm">{t('questions.form.notFound')}</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <Link to="/admin/questions" className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-block">
        &larr; {t('questions.form.backToList')}
      </Link>

      <h1 className="text-xl font-semibold text-gray-900">
        {mode === 'create' ? t('questions.form.createTitle') : t('questions.form.editTitle')}
      </h1>

      {generalError && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm font-medium">{generalError}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('questions.form.questionText')} *</label>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder={t('questions.form.questionTextPlaceholder')}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.text ? 'border-red-400' : 'border-gray-300'}`}
        />
        {fieldErrors.text && <p className="text-red-500 text-xs mt-1">{fieldErrors.text}</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('questions.form.level')} *</label>
          <select
            value={levelId} onChange={(e) => setLevelId(e.target.value)} disabled={levelsLoading}
            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.levelId ? 'border-red-400' : 'border-gray-300'}`}
          >
            <option value="">{t('questions.form.levelRequired')}</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {fieldErrors.levelId && <p className="text-red-500 text-xs mt-1">{fieldErrors.levelId}</p>}
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('questions.form.category')}</label>
          <input
            type="text" value={category} onChange={(e) => setCategory(e.target.value)}
            placeholder={t('questions.form.categoryPlaceholder')}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.category ? 'border-red-400' : 'border-gray-300'}`}
          />
          {fieldErrors.category && <p className="text-red-500 text-xs mt-1">{fieldErrors.category}</p>}
        </div>
      </div>

      <QuestionOptionList
        options={options} errors={fieldErrors} disabled={submitting}
        onAdd={addOption} onRemove={removeOption}
        onUpdateText={updateOptionText} onSelectCorrect={selectCorrect}
        maxReached={options.length >= 10}
      />

      <div className="flex justify-end">
        <button
          type="submit" disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t('common.loading', 'Saving…') : t('questions.form.save')}
        </button>
      </div>
    </form>
  )
}
