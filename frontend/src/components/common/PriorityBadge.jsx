const PRIORITY_META = {
  high:     'bg-red-100 text-red-700 border-red-200',
  medium:   'bg-orange-100 text-orange-700 border-orange-200',
  low:      'bg-green-100 text-green-700 border-green-200',
  critical: 'bg-red-200 text-red-800 border-red-300',
}

export default function PriorityBadge({ priority }) {
  if (!priority) return null
  const color = PRIORITY_META[priority?.toLowerCase()] || 'bg-gray-100 text-gray-500 border-gray-200'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${color}`}>
      {priority}
    </span>
  )
}
