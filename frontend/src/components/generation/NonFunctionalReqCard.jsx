import PriorityBadge from '../common/PriorityBadge'

const CATEGORY_COLORS = {
  performance:    'bg-blue-100 text-blue-700 border-blue-200',
  security:       'bg-red-100 text-red-700 border-red-200',
  scalability:    'bg-purple-100 text-purple-700 border-purple-200',
  availability:   'bg-teal-100 text-teal-700 border-teal-200',
  reliability:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  maintainability:'bg-orange-100 text-orange-700 border-orange-200',
  usability:      'bg-pink-100 text-pink-700 border-pink-200',
  compliance:     'bg-yellow-100 text-yellow-700 border-yellow-200',
}

export default function NonFunctionalReqCard({ artifact }) {
  const { req_id, category, title, description, measurable_criteria, priority } =
    artifact.content_json || {}
  const catColor = CATEGORY_COLORS[category?.toLowerCase()] || 'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {req_id && (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
              {req_id}
            </span>
          )}
          {category && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${catColor}`}>
              {category}
            </span>
          )}
          <h3 className="text-sm font-semibold text-gray-900">{title || artifact.title}</h3>
        </div>
        <PriorityBadge priority={priority} />
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-gray-700 leading-relaxed mb-3">{description}</p>
      )}

      {/* Measurable Criteria */}
      {measurable_criteria && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-indigo-600 font-semibold uppercase tracking-wider mb-1">
            Measurable Criteria
          </p>
          <p className="text-xs text-indigo-800 leading-relaxed">{measurable_criteria}</p>
        </div>
      )}
    </div>
  )
}
