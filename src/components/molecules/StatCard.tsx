interface StatCardProps {
  label: string
  value: number | string
  icon?: string
  loading: boolean
}

export default function StatCard({ label, value, icon, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-8 bg-gray-200 rounded w-16" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
