import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLevels } from '../hooks/useLevels'
import type { ActiveLevelRange, Level } from '../types'

type FormMode = 'metadata' | 'distribution'
type FormState = { name: string; description: string }
const emptyForm: FormState = { name: '', description: '' }

export default function LevelsScreen() {
  const { t } = useTranslation()
  const { levels, activeDistribution, loading, error, updateLevelMetadata, replaceActiveLevelDistribution, refetch } = useLevels({ includeHistorical: true })
  const [mode, setMode] = useState<FormMode | null>(null)
  const [selected, setSelected] = useState<Level | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [draft, setDraft] = useState<ActiveLevelRange[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const orderedLevels = useMemo(() => [...levels].sort((a, b) => a.min_score - b.min_score || (a.version ?? 1) - (b.version ?? 1)), [levels])
  const activeLevels = useMemo(() => orderedLevels.filter((level) => level.is_active !== false), [orderedLevels])
  const before = activeDistribution?.levels ?? activeLevels.map(({ id, min_score, max_score }) => ({ id, min_score, max_score }))
  const draftById = useMemo(() => new Map(draft.map((range) => [range.id, range])), [draft])
  const nameById = useMemo(() => new Map(activeLevels.map((level) => [level.id, level.name])), [activeLevels])

  const beginMetadata = (level: Level) => {
    setMode('metadata'); setSelected(level); setForm({ name: level.name, description: level.description ?? '' }); setFormError(null); setNotice(null)
  }
  const beginDistribution = () => {
    setMode('distribution'); setSelected(null); setDraft(before.map((range) => ({ ...range }))); setFormError(null); setNotice(null)
  }
  const beginDeactivation = (level: Level) => {
    const target = before.find((range) => range.id === level.id)
    if (!target || activeLevels.length < 2) { setFormError(t('levels.errors.lastActive')); return }
    const index = before.findIndex((range) => range.id === level.id)
    const lower = before[index - 1]
    const upper = before[index + 1]
    const width = target.max_score - target.min_score + 1
    const lowerShare = Math.floor(width / 2)
    const after = before.filter((range) => range.id !== level.id).map((range) => {
      if (range.id === lower?.id) return { ...range, max_score: upper ? range.max_score + lowerShare : target.max_score }
      if (range.id === upper?.id) return { ...range, min_score: lower ? target.min_score + lowerShare : target.min_score }
      return { ...range }
    })
    setMode('distribution'); setSelected(level); setDraft(after); setFormError(null); setNotice(null)
  }
  const close = () => { setMode(null); setSelected(null); setDraft([]); setFormError(null) }
  const friendlyError = (message: string, code?: string) => code === '23505' ? t('levels.errors.duplicate') : code === '42501' ? t('levels.errors.permission') : message || t('levels.errors.saveFailed')

  const validateDraft = () => {
    const ordered = [...draft].sort((a, b) => a.min_score - b.min_score)
    if (!ordered.length || ordered.some(({ min_score, max_score }) => !Number.isInteger(min_score) || !Number.isInteger(max_score) || min_score < 0 || max_score > 100 || min_score > max_score) || ordered[0].min_score !== 0 || ordered[ordered.length - 1].max_score !== 100 || ordered.some((range, index) => index > 0 && range.min_score !== ordered[index - 1].max_score + 1)) {
      return t('levels.validation.distribution')
    }
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setFormError(null)
    if (mode === 'metadata') {
      if (!form.name.trim()) { setFormError(t('levels.validation.required')); return }
      setSaving(true)
      const result = await updateLevelMetadata?.({ level_id: selected!.id, name: form.name.trim(), description: form.description.trim() || null })
      setSaving(false)
      if (result?.error) { setFormError(friendlyError(result.error, result.code)); return }
      close(); setNotice(t('levels.success.metadata')); refetch?.(); return
    }
    const validation = validateDraft()
    if (validation) { setFormError(validation); return }
    if (!window.confirm(selected ? `${t('levels.confirm.title')}\n\n${selected.name}\n\n${t('levels.confirm.message')}` : t('levels.confirm.distribution'))) return
    setSaving(true)
    const result = await replaceActiveLevelDistribution?.({ expected_revision: activeDistribution?.revision ?? 0, levels: draft, ...(selected ? { deactivate_level_id: selected.id } : {}) })
    setSaving(false)
    if (!result || result.error || !result.data) {
      if (result?.conflict) { close(); setFormError(t('levels.errors.conflict')); refetch?.() }
      else setFormError(friendlyError(result?.error ?? t('levels.errors.saveFailed'), result?.code))
      return
    }
    const wasDeactivation = Boolean(selected)
    close(); setNotice(wasDeactivation ? t('levels.success.deactivated') : t('levels.success.distribution')); refetch?.()
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-xl font-semibold text-gray-900">{t('levels.title')}</h1><p className="text-sm text-gray-500">{t('levels.subtitle')}</p></div>
      <button onClick={beginDistribution} disabled={loading || !before.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{t('levels.actions.distribution')}</button>
    </div>
    {(error || formError || notice) && <div role="alert" className={`rounded-lg border p-4 text-sm ${notice && !error && !formError ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}><strong>{notice && !error && !formError ? t('levels.success.title') : t('levels.errors.title')}</strong><p>{notice && !error && !formError ? notice : error ? t('levels.errors.loadFailed') : formError}</p>{error && <p className="mt-1 text-red-500">{error}</p>}</div>}
    {loading ? <div className="rounded-xl border border-gray-200 bg-white p-5"><div className="h-10 animate-pulse rounded bg-gray-100" /></div> : <div className="grid gap-3">
      {orderedLevels.map((level) => <article key={level.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-gray-900">{level.name}</h2><span className="text-sm text-gray-500">v{level.version ?? 1}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${level.is_active === false ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>{level.is_active === false ? t('levels.status.inactive') : t('levels.status.active')}</span></div><p className="text-sm font-medium text-gray-700">{level.min_score}–{level.max_score}</p><p className="text-sm text-gray-500">{level.description || t('levels.noDescription')}</p>{level.is_active === false && <p className="text-xs text-gray-400">{t('levels.historical')}</p>}</div><div className="flex flex-wrap gap-2"><button onClick={() => beginMetadata(level)} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700">{t('levels.actions.edit')}</button>{level.is_active && <button onClick={() => beginDeactivation(level)} className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700">{t('levels.actions.deactivate')}</button>}</div></div></article>)}
      {!orderedLevels.length && <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{t('levels.empty')}</p>}
    </div>}
    {mode === 'distribution' && <section className="rounded-xl border border-blue-200 bg-blue-50 p-5" aria-labelledby="distribution-title"><h2 id="distribution-title" className="mb-2 font-semibold text-gray-900">{selected ? t('levels.distribution.deactivationTitle', { name: selected.name }) : t('levels.distribution.title')}</h2><p className="mb-4 text-sm text-gray-600">{selected ? t('levels.distribution.deactivationHelp') : t('levels.distribution.help')}</p><form onSubmit={submit}><div className="grid gap-3 sm:grid-cols-2">{before.map((range) => { const value = draftById.get(range.id); if (selected?.id === range.id) return <fieldset key={range.id} className="rounded-lg border border-red-100 bg-red-50 p-3"><legend className="px-1 text-sm font-medium text-gray-700">{nameById.get(range.id) ?? range.id}</legend><p className="text-sm text-gray-600">{t('levels.distribution.removed')}: {range.min_score}–{range.max_score}</p></fieldset>; return <fieldset key={range.id} className="rounded-lg border border-blue-100 bg-white p-3"><legend className="px-1 text-sm font-medium text-gray-700">{nameById.get(range.id) ?? range.id}</legend><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-gray-600">{t('levels.form.min')}<input aria-label={`${t('levels.form.min')} ${nameById.get(range.id) ?? range.id}`} type="number" min="0" max="100" value={value?.min_score ?? range.min_score} onChange={(e) => setDraft(draft.map((item) => item.id === range.id ? { ...item, min_score: Number(e.target.value) } : item))} className="rounded border border-gray-300 px-2 py-1.5 text-sm" /></label><label className="grid gap-1 text-xs text-gray-600">{t('levels.form.max')}<input aria-label={`${t('levels.form.max')} ${nameById.get(range.id) ?? range.id}`} type="number" min="0" max="100" value={value?.max_score ?? range.max_score} onChange={(e) => setDraft(draft.map((item) => item.id === range.id ? { ...item, max_score: Number(e.target.value) } : item))} className="rounded border border-gray-300 px-2 py-1.5 text-sm" /></label></div><p className="mt-2 text-xs text-gray-500">{t('levels.distribution.before')}: {range.min_score}–{range.max_score} · {t('levels.distribution.after')}: {value?.min_score ?? range.min_score}–{value?.max_score ?? range.max_score}</p></fieldset> })}</div><div className="mt-4 flex gap-2"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? t('levels.form.saving') : t('levels.form.save')}</button><button type="button" onClick={close} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">{t('levels.form.cancel')}</button></div></form></section>}
    {mode === 'metadata' && <section className="rounded-xl border border-blue-200 bg-blue-50 p-5"><h2 className="mb-4 font-semibold text-gray-900">{t('levels.form.metadata')}</h2><form onSubmit={submit} className="grid gap-4"><label className="grid gap-1 text-sm font-medium text-gray-700">{t('levels.form.name')}<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2" /></label><label className="grid gap-1 text-sm font-medium text-gray-700">{t('levels.form.description')}<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2" rows={2} /></label><div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? t('levels.form.saving') : t('levels.form.save')}</button><button type="button" onClick={close} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">{t('levels.form.cancel')}</button></div></form></section>}
  </div>
}
