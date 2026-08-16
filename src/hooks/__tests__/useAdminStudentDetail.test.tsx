import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminStudentDetail } from '../useAdminStudentDetail'

let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { rpc } } }))

const student = { student_id: 'student-1', full_name: 'Ada Student', ci: 'CI-1', email: 'ada@test.local', phone: '71234567', created_at: '2026-07-01T00:00:00Z' }

beforeEach(() => {
  vi.clearAllMocks()
  rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ data: name === 'get_admin_student_detail' ? [student] : [], error: null }))
})

describe('useAdminStudentDetail', () => {
  it('categorizes detail load failures separately from authorization denials', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } }).mockResolvedValueOnce({ data: [], error: null })
    const { result } = renderHook(() => useAdminStudentDetail('student-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.loadError).toBe('permission')

    rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000' } }).mockResolvedValueOnce({ data: [], error: null })
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.loadError).toBe('load')
  })

  it('treats RPC failures and empty update results as update failures', async () => {
    const { result } = renderHook(() => useAdminStudentDetail('student-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002' } })
    let saved = true
    await act(async () => { saved = await result.current.saveProfile('Ada Updated', '70123456') })
    expect(saved).toBe(false)
    expect(result.current.saveError).toBe('update')

    rpc.mockResolvedValueOnce({ data: [], error: null })
    await act(async () => { saved = await result.current.saveProfile('Ada Updated', '70123456') })
    expect(saved).toBe(false)
    expect(result.current.saveError).toBe('update')
  })

  it('updates local state only after a returned profile row', async () => {
    const updatedStudent = { ...student, full_name: 'Ada Updated', phone: '70123456' }
    const { result } = renderHook(() => useAdminStudentDetail('student-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    rpc.mockResolvedValueOnce({ data: [updatedStudent], error: null })

    let saved = false
    await act(async () => { saved = await result.current.saveProfile('Ada Updated', '70123456') })
    expect(saved).toBe(true)
    expect(result.current.student).toEqual(updatedStudent)
    expect(result.current.saveError).toBeNull()
  })

  it('does not invoke the master-only exception RPC for standard administrators', async () => {
    const { result } = renderHook(() => useAdminStudentDetail('student-1', false))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(rpc).not.toHaveBeenCalledWith('get_exam_attempt_exception', expect.anything())
  })

  it('loads and changes an exception only when the master-only surface is enabled', async () => {
    rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'get_admin_student_detail' ? [student] : name === 'get_exam_attempt_exception' ? [{ exception_id: 'exception-1', state: 'pending' }] : [], error: null }))
    const { result } = renderHook(() => useAdminStudentDetail('student-1', true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.exception?.exception_id).toBe('exception-1')
    await act(async () => { await result.current.grantException('Documented local exception') })
    expect(rpc).toHaveBeenCalledWith('grant_exam_attempt_exception', { p_student_id: 'student-1', p_reason: 'Documented local exception' })
  })
})
