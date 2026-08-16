import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AdminStudentAttempt, AdminStudentDetail, ExamAttemptException } from '../types'

export interface UseAdminStudentDetailResult {
  student: AdminStudentDetail | null
  attempts: AdminStudentAttempt[]
  exception: ExamAttemptException | null
  loading: boolean
  saving: boolean
  loadError: 'load' | 'permission' | null
  saveError: 'update' | null
  saveProfile: (fullName: string, phone: string) => Promise<boolean>
  grantException: (reason: string) => Promise<boolean>
  revokeException: () => Promise<boolean>
  refetch: () => void
}

function isPermissionError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '42501'
}

export function useAdminStudentDetail(studentId: string | undefined, includeException = false): UseAdminStudentDetailResult {
  const [student, setStudent] = useState<AdminStudentDetail | null>(null)
  const [attempts, setAttempts] = useState<AdminStudentAttempt[]>([])
  const [exception, setException] = useState<ExamAttemptException | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<'load' | 'permission' | null>(null)
  const [saveError, setSaveError] = useState<'update' | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      if (!studentId) {
        setStudent(null)
        setAttempts([])
        setException(null)
        setLoadError(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError(null)
      try {
        const [{ data: studentData, error: studentError }, { data: attemptData, error: attemptError }, exceptionResult] = await Promise.all([
          supabase.rpc('get_admin_student_detail', { p_student_id: studentId }),
          supabase.rpc('get_admin_student_attempts', { p_student_id: studentId, p_page_size: 50 }),
          includeException ? supabase.rpc('get_exam_attempt_exception', { p_student_id: studentId }) : Promise.resolve({ data: [], error: null }),
        ])
        if (cancelled) return
        if (studentError) throw studentError
        if (attemptError) throw attemptError
        if (exceptionResult.error) throw exceptionResult.error
        setStudent(((studentData ?? [])[0] ?? null) as AdminStudentDetail | null)
        setAttempts((attemptData ?? []) as AdminStudentAttempt[])
        setException(((exceptionResult.data ?? [])[0] ?? null) as ExamAttemptException | null)
      } catch (err) {
        if (!cancelled) {
          setStudent(null)
          setAttempts([])
          setException(null)
          setLoadError(isPermissionError(err) ? 'permission' : 'load')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDetail()
    return () => { cancelled = true }
  }, [studentId, includeException, fetchKey])

  const saveProfile = useCallback(async (fullName: string, phone: string) => {
    if (!studentId) return false
    setSaving(true)
    setSaveError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('update_admin_student_profile', {
        p_student_id: studentId,
        p_full_name: fullName,
        p_phone: phone || null,
      })
      if (rpcError) throw rpcError
      const updatedStudent = ((data ?? [])[0] ?? null) as AdminStudentDetail | null
      if (!updatedStudent) throw new Error('Student profile update returned no row')
      setStudent(updatedStudent)
      return true
    } catch {
      setSaveError('update')
      return false
    } finally {
      setSaving(false)
    }
  }, [studentId])

  const grantException = useCallback(async (reason: string) => {
    if (!studentId) return false
    setSaving(true); setSaveError(null)
    try {
      const { error } = await supabase.rpc('grant_exam_attempt_exception', { p_student_id: studentId, p_reason: reason })
      if (error) throw error
      refetch()
      return true
    } catch { setSaveError('update'); return false } finally { setSaving(false) }
  }, [refetch, studentId])

  const revokeException = useCallback(async () => {
    if (!exception) return false
    setSaving(true); setSaveError(null)
    try {
      const { error } = await supabase.rpc('revoke_exam_attempt_exception', { p_exception_id: exception.exception_id })
      if (error) throw error
      refetch()
      return true
    } catch { setSaveError('update'); return false } finally { setSaving(false) }
  }, [exception, refetch])

  return { student, attempts, exception, loading, saving, loadError, saveError, saveProfile, grantException, revokeException, refetch }
}
