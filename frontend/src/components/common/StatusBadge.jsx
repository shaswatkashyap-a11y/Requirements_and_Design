const STATUS_META = {
  pending:              { label: 'Pending',              color: 'bg-gray-100 text-gray-500 border-gray-200' },
  queued:               { label: 'Queued',               color: 'bg-gray-100 text-gray-600 border-gray-200' },
  extracting_modules:   { label: 'Extracting Modules',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  generating_artifacts: { label: 'Generating Artifacts', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  completed:            { label: 'Completed',             color: 'bg-green-100 text-green-700 border-green-200' },
  failed:               { label: 'Failed',                color: 'bg-red-100 text-red-700 border-red-200' },
  // SOW statuses
  uploaded:             { label: 'Uploaded',              color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  parsed:               { label: 'Parsed',                color: 'bg-green-100 text-green-700 border-green-200' },
  parsing:              { label: 'Parsing',               color: 'bg-blue-100 text-blue-700 border-blue-200' },
}

export default function StatusBadge({ status, size = 'sm', pulse = false }) {
  const meta = STATUS_META[status] || { label: status?.toUpperCase() || '—', color: 'bg-gray-100 text-gray-500 border-gray-200' }
  const isAnimated = pulse && (status === 'generating_artifacts' || status === 'extracting_modules')

  const sizeClasses = size === 'lg'
    ? 'text-xs font-semibold px-2.5 py-1 rounded-md'
    : 'text-[10px] font-semibold px-2 py-0.5 rounded'

  return (
    <span className={`inline-flex items-center gap-1 border ${sizeClasses} ${meta.color}`}>
      {isAnimated && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {meta.label}
    </span>
  )
}
