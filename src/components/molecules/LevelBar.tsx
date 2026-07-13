import type { LevelDistributionItem } from '../../types'

interface LevelBarProps {
  levels: LevelDistributionItem[]
  loading: boolean
}

const barColors = [
  'bg-blue-600',
  'bg-cyan-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-600',
  'bg-indigo-600',
  'bg-teal-600',
]

export default function LevelBar({ levels, loading }: LevelBarProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <div className="h-5 bg-gray-200 rounded w-40 mb-4 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-1">
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="h-6 bg-gray-200 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (levels.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Level Distribution</h3>
        <p className="text-gray-400 text-sm">No data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Level Distribution</h3>
      <div className="space-y-3">
        {levels.map((lvl, i) => (
          <div key={lvl.level_id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">{lvl.name}</span>
              <span className="text-gray-500">
                {lvl.count} ({lvl.percentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-5">
              <div
                className={`h-5 rounded-full ${barColors[i % barColors.length]} transition-all duration-300`}
                style={{ width: `${lvl.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
