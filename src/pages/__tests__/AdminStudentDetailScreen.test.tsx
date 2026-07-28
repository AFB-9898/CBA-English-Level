import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminStudentDetailScreen from '../AdminStudentDetailScreen'
import { useAdminStudentDetail } from '../../hooks/useAdminStudentDetail'

vi.mock('../../hooks/useAdminStudentDetail', () => ({ useAdminStudentDetail: vi.fn() }))
const mockUseAdminStudentDetail = vi.mocked(useAdminStudentDetail)

function base(): ReturnType<typeof useAdminStudentDetail> {
  return { student: { student_id: 'student-1', full_name: 'Ada Student', ci: 'CI-1', email: 'ada@test.local', phone: '71234567', created_at: '2026-07-01T00:00:00Z' }, attempts: [{ attempt_id: 'attempt-1', status: 'completed', started_at: '2026-07-01T10:00:00Z', completed_at: '2026-07-01T10:20:00Z', score: 88, cefr_level_code: 'B2', cefr_level_name: 'Vantage', cefr_level_version: 1 }], loading: false, saving: false, loadError: null, saveError: null, saveProfile: vi.fn().mockResolvedValue(true), refetch: vi.fn() }
}

function renderScreen() {
  return render(<MemoryRouter initialEntries={['/admin/students/student-1']}><Routes><Route path="/admin/students/:studentId" element={<AdminStudentDetailScreen />} /></Routes></MemoryRouter>)
}

beforeEach(() => { vi.clearAllMocks(); mockUseAdminStudentDetail.mockReturnValue(base()) })

describe('AdminStudentDetailScreen', () => {
  it('allows only permitted profile fields and shows read-only attempt summaries', () => {
    renderScreen()
    expect(screen.getByLabelText('Full Name')).toBeEnabled()
    expect(screen.getByLabelText('Phone')).toBeEnabled()
    expect(screen.queryByLabelText('CI (Identity Card)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete|edit result/i })).not.toBeInTheDocument()
    expect(screen.getByText('B2 - Vantage (v1)')).toBeInTheDocument()
    expect(screen.getByText('Read-only history and results. Answers are not available here.')).toBeInTheDocument()
  })

  it('saves only full name and phone through the restricted hook action', () => {
    const state = base()
    mockUseAdminStudentDetail.mockReturnValue(state)
    renderScreen()
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Ada Updated' } })
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '70123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(state.saveProfile).toHaveBeenCalledWith('Ada Updated', '70123456')
  })

  it.each([
    ['loadError', 'load', 'We could not load this student profile.'],
    ['loadError', 'permission', 'You do not have permission to access student profiles.'],
    ['saveError', 'update', 'We could not update this student profile.'],
  ] as const)('shows the correct %s message for %s', (field, error, message) => {
    mockUseAdminStudentDetail.mockReturnValue({ ...base(), [field]: error })
    renderScreen()
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })
})
