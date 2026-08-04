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

  if (loadingQuestion) return <p className="cba-admin__module-subtitle text-sm">{t('questions.form.loadingQuestion')}</p>
  if (notFound) return <p role="alert" className="cba-admin__alert cba-admin__alert--error rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t('questions.form.notFound')}</p>

  return (
    <form onSubmit={handleSubmit} className="cba-admin__module space-y-6" noValidate>
      <Link to="/admin/questions" className="cba-admin__action text-sm inline-block">
        &larr; {t('questions.form.backToList')}
      </Link>

      <h1 className="cba-admin__module-title">
        {mode === 'create' ? t('questions.form.createTitle') : t('questions.form.editTitle')}
      </h1>

      {generalError && (
        <div role="alert" className="cba-admin__alert cba-admin__alert--error bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm font-medium">{generalError}</p>
        </div>
      )}

      <div className="cba-admin__panel p-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('questions.form.questionText')} *</label>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder={t('questions.form.questionTextPlaceholder')}
          className={`cba-admin__field w-full px-3 py-2 border rounded-lg text-sm ${fieldErrors.text ? 'border-red-400' : ''}`}
        />
        {fieldErrors.text && <p className="text-red-500 text-xs mt-1">{fieldErrors.text}</p>}
      </div>

      <div className="cba-admin__panel flex flex-col gap-4 p-5 sm:flex-row">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('questions.form.level')} *</label>
          <select
            value={levelId} onChange={(e) => setLevelId(e.target.value)} disabled={levelsLoading}
            className={`cba-admin__field w-full px-3 py-2 border rounded-lg text-sm bg-white ${fieldErrors.levelId ? 'border-red-400' : ''}`}
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
            className={`cba-admin__field w-full px-3 py-2 border rounded-lg text-sm ${fieldErrors.category ? 'border-red-400' : ''}`}
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
          className="cba-admin__button cba-admin__button--primary px-6 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t('common.loading', 'Saving…') : t('questions.form.save')}
        </button>
      </div>
    </form>
  )
}
