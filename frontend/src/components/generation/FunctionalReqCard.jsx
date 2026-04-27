import PriorityBadge from '../common/PriorityBadge'

export default function FunctionalReqCard({ artifact }) {
  const { req_id, title, description, user_story, acceptance_criteria = [], priority, source_section } =
    artifact.content_json || {}

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {req_id && (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
              {req_id}
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

      {/* User Story */}
      {user_story && (
        <div className="bg-blue-50 border-l-2 border-blue-300 px-3 py-2 mb-3 rounded-r-lg">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1">User Story</p>
          <p className="text-xs text-blue-800 italic leading-relaxed">{user_story}</p>
        </div>
      )}

      {/* Acceptance Criteria */}
      {acceptance_criteria.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5">
            Acceptance Criteria
          </p>
          <ul className="list-disc list-outside pl-4 space-y-1">
            {acceptance_criteria.map((ac, i) => (
              <li key={i} className="text-xs text-gray-700 leading-snug marker:text-gray-400">{ac}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      {source_section && (
        <div className="pt-2 border-t border-gray-100">
          <span className="text-[10px] text-gray-400">Source: {source_section}</span>
        </div>
      )}
    </div>
  )
}
