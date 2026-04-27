import { Clock, Link } from 'lucide-react'

const TASK_TYPE_COLORS = {
  development:  'bg-blue-100 text-blue-700 border-blue-200',
  testing:      'bg-purple-100 text-purple-700 border-purple-200',
  design:       'bg-pink-100 text-pink-700 border-pink-200',
  devops:       'bg-orange-100 text-orange-700 border-orange-200',
  documentation:'bg-gray-100 text-gray-600 border-gray-200',
  analysis:     'bg-teal-100 text-teal-700 border-teal-200',
  review:       'bg-yellow-100 text-yellow-700 border-yellow-200',
}

export default function TaskCard({ artifact, onLinkedReqClick }) {
  const { task_id, title, description, task_type, estimated_hours, acceptance_criteria = [], linked_requirement_id } =
    artifact.content_json || {}
  const typeColor = TASK_TYPE_COLORS[task_type?.toLowerCase()] || 'bg-gray-100 text-gray-500 border-gray-200'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {task_id && (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded">
              {task_id}
            </span>
          )}
          {task_type && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${typeColor}`}>
              {task_type}
            </span>
          )}
          <h3 className="text-sm font-semibold text-gray-900">{title || artifact.title}</h3>
        </div>
        {estimated_hours != null && (
          <span className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
            <Clock size={11} className="text-gray-400" />
            {estimated_hours}h
          </span>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-gray-700 leading-relaxed mb-3">{description}</p>
      )}

      {/* Linked requirement */}
      {linked_requirement_id && (
        <div className="mb-3">
          <button
            onClick={() => onLinkedReqClick?.(linked_requirement_id)}
            className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Link size={10} />
            Linked: {linked_requirement_id}
          </button>
        </div>
      )}

      {/* Acceptance Criteria */}
      {acceptance_criteria.length > 0 && (
        <div>
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
    </div>
  )
}
