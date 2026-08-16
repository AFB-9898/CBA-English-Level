import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { DashboardStats, LevelDistributionItem, RecentExam } from '../types'

interface UseDashboardStatsResult {
  stats: DashboardStats
  distribution: LevelDistributionItem[]
  recentExams: RecentExam[]
  loading: boolean
  error: string | null
}

interface AdminDashboardPayload {
  totals: { students: number; exams: number }
  completed_today: number
  completed_score_average: number
  level_distribution: LevelDistributionItem[]
  recent_completed: Array<{
    id: string
    student_full_name: string | null
    level_name: string | null
    score: number | null
    completed_at: string | null
  }>
}

const initialStats: DashboardStats = {
  totalStudents: 0,
  totalExams: 0,
  examsToday: 0,
  avgScore: 0,
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return 'Unknown error'
}

export function useDashboardStats(): UseDashboardStatsResult {
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [distribution, setDistribution] = useState<LevelDistributionItem[]>([])
  const [recentExams, setRecentExams] = useState<RecentExam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      setLoading(true)
      setError(null)

      try {
        const { data, error: rpcError } = await supabase.rpc('get_admin_dashboard_statistics')

        if (cancelled) return
        if (rpcError) throw rpcError
        const payload = data as AdminDashboardPayload

        setStats({
          totalStudents: payload.totals.students,
          totalExams: payload.totals.exams,
          examsToday: payload.completed_today,
          avgScore: payload.completed_score_average,
        })
        setDistribution(payload.level_distribution)
        setRecentExams(payload.recent_completed.map((exam) => ({
          id: exam.id,
          student: exam.student_full_name ? { full_name: exam.student_full_name } : null,
          level: exam.level_name ? { name: exam.level_name } : null,
          score: exam.score,
          status: 'completed',
          completed_at: exam.completed_at,
        })))
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStats()

    return () => {
      cancelled = true
    }
  }, [])

  return { stats, distribution, recentExams, loading, error }
}
