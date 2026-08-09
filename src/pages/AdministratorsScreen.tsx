import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdministrators } from '../hooks/useAdministrators'
import type { Administrator } from '../types'

export default function AdministratorsScreen() {
  const { t } = useTranslation()
  const { administrators, loading, error, refetch, updateAdministrator, inviteAdministrator } = useAdministrators()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  async function invite(event: FormEvent) {
    event.preventDefault()
    setInviteError(await inviteAdministrator(email, fullName))
    setEmail('')
    setFullName('')
  }

  return <div className="cba-admin__module space-y-6">
    <header className="cba-admin__module-header flex items-end justify-between gap-4"><div><h1 className="cba-admin__module-title">{t('administrators.title')}</h1><p className="cba-admin__module-subtitle text-sm">{t('administrators.subtitle')}</p></div><button type="button" onClick={refetch} className="cba-admin__button cba-admin__button--secondary rounded-lg border px-4 py-2 text-sm">{t('administrators.refresh')}</button></header>
    {error && <div role="alert" className="cba-admin__alert cba-admin__alert--error p-4">{t('administrators.loadFailed')}</div>}
    <form onSubmit={invite} className="cba-admin__panel grid gap-3 p-4 sm:grid-cols-3"><input required aria-label={t('common.fullName')} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={t('common.fullName')} className="cba-admin__field rounded border px-3 py-2" /><input required type="email" aria-label={t('common.email')} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('common.email')} className="cba-admin__field rounded border px-3 py-2" /><button className="cba-admin__button cba-admin__button--primary rounded px-4 py-2">{t('administrators.invite')}</button>{inviteError && <p role="alert" className="text-sm text-red-700">{inviteError}</p>}</form>
    {loading ? <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-gray-100" /> : <section className="cba-admin__table-wrap overflow-x-auto"><table className="cba-admin__table w-full text-sm"><thead><tr><th>{t('common.fullName')}</th><th>{t('common.email')}</th><th>{t('administrators.role')}</th><th>{t('administrators.status')}</th><th><span className="sr-only">{t('administrators.save')}</span></th></tr></thead><tbody>{administrators.map((administrator) => <AdministratorRow key={administrator.id} administrator={administrator} save={updateAdministrator} />)}</tbody></table></section>}
  </div>
}

function AdministratorRow({ administrator, save }: { administrator: Administrator; save: (administrator: Administrator) => Promise<string | null> }) {
  const { t } = useTranslation()
  return <tr><td>{administrator.full_name}</td><td>{administrator.email}</td><td><select aria-label={`${t('administrators.role')} ${administrator.email}`} defaultValue={administrator.role} onChange={(event) => void save({ ...administrator, role: event.target.value as Administrator['role'] })}><option value="master_admin">{t('administrators.roles.masterAdmin')}</option><option value="admin">{t('administrators.roles.admin')}</option></select></td><td><label><input aria-label={`${t('administrators.status')} ${administrator.email}`} type="checkbox" defaultChecked={administrator.is_active} onChange={(event) => void save({ ...administrator, is_active: event.target.checked })} /> {administrator.is_active ? t('administrators.active') : t('administrators.inactive')}</label></td><td /></tr>
}
