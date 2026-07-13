import type { RecentExam } from '../../types'

interface RecentExamsTableProps {
  exams: RecentExam[]
  loading: boolean
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-gray-100 text-gray-600',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  )
}

export default function RecentExamsTable({ exams, loading }: RecentExamsTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <div className="h-5 bg-gray-200 rounded w-36 mb-4 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (exams.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Exams</h3>
        <p className="text-gray-400 text-sm">No exams recorded yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 overflow-x-auto">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Exams</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="pb-2 font-medium">Student</th>
            <th className="pb-2 font-medium">Score</th>
            <th className="pb-2 font-medium">Level</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr key={exam.id} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 text-gray-900">{exam.student?.full_name ?? '—'}</td>
              <td className="py-2.5 text-gray-700">{exam.score ?? '—'}</td>
              <td className="py-2.5 text-gray-700">{exam.level?.name ?? '—'}</td>
              <td className="py-2.5">
                <StatusBadge status={exam.status} />
              </td>
              <td className="py-2.5 text-gray-500">
                {exam.completed_at
                  ? new Date(exam.completed_at).toLocaleDateString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
