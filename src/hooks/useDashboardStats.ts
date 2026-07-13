import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { DashboardStats, LevelDistributionItem, RecentExam, Level } from '../types'

interface UseDashboardStatsResult {
  stats: DashboardStats
  distribution: LevelDistributionItem[]
  recentExams: RecentExam[]
  levels: Level[]
  loading: boolean
  error: string | null
}

const initialStats: DashboardStats = {
  totalStudents: 0,
  totalExams: 0,
  examsToday: 0,
  avgScore: 0,
}

export function useDashboardStats(): UseDashboardStatsResult {
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [distribution, setDistribution] = useState<LevelDistributionItem[]>([])
  const [recentExams, setRecentExams] = useState<RecentExam[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      setLoading(true)
      setError(null)

      const today = new Date().toISOString().split('T')[0]

      try {
        const [
          studentsRes,
          examsRes,
          todayRes,
          scoresRes,
          levelIdsRes,
          recentRes,
          levelsRes,
        ] = await Promise.all([
          supabase.from('student').select('id', { count: 'exact', head: true }),
          supabase.from('exam').select('id', { count: 'exact', head: true }),
          supabase
            .from('exam')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'completed')
            .gte('completed_at', today),
          supabase.from('exam').select('score').eq('status', 'completed'),
          supabase.from('exam').select('level_id').eq('status', 'completed'),
          supabase
            .from('exam')
            .select('*, student:student_id(full_name), level:level_id(name)')
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(10),
          supabase.from('level').select('*'),
        ])

        if (cancelled) return

        // Check for errors
        const errors = [studentsRes, examsRes, todayRes, scoresRes, levelIdsRes, recentRes, levelsRes]
          .filter((r) => r.error)
          .map((r) => r.error!.message)

        if (errors.length > 0) {
          throw new Error(errors[0])
        }

        // Compute average score
        const scores = (scoresRes.data ?? [])
          .map((e) => e.score)
          .filter((s): s is number => s !== null)
        const avgScore =
          scores.length > 0
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : 0

        // Compute level distribution
        const levelRows = levelsRes.data ?? []
        const examLevelIds = (levelIdsRes.data ?? []).map((e) => e.level_id)
        const totalExamsForDist = examLevelIds.length

        const levelCountMap: Record<string, number> = {}
        for (const lid of examLevelIds) {
          levelCountMap[lid] = (levelCountMap[lid] ?? 0) + 1
        }

        const computedDistribution: LevelDistributionItem[] = levelRows.map((lvl) => ({
          level_id: lvl.id,
          name: lvl.name,
          count: levelCountMap[lvl.id] ?? 0,
          percentage:
            totalExamsForDist > 0
              ? Math.round(((levelCountMap[lvl.id] ?? 0) / totalExamsForDist) * 100)
              : 0,
        }))

        setStats({
          totalStudents: studentsRes.count ?? 0,
          totalExams: examsRes.count ?? 0,
          examsToday: todayRes.count ?? 0,
          avgScore,
        })
        setDistribution(computedDistribution)
        setRecentExams((recentRes.data ?? []) as RecentExam[])
        setLevels(levelRows as Level[])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
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

  return { stats, distribution, recentExams, levels, loading, error }
}
