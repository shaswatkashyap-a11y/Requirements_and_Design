import { Link } from 'lucide-react'

const TEST_TYPE_COLORS = {
  functional:   'bg-blue-100 text-blue-700 border-blue-200',
  integration:  'bg-purple-100 text-purple-700 border-purple-200',
  edge_case:    'bg-orange-100 text-orange-700 border-orange-200',
  unit:         'bg-teal-100 text-teal-700 border-teal-200',
  performance:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  regression:   'bg-pink-100 text-pink-700 border-pink-200',
}

export default function TestCaseCard({ artifact }) {
  const {
    test_id,
    title,
    linked_requirement_id,
    preconditions = [],
    steps = [],
    expected_result,
    test_type,
  } = artifact.content_json || {}

  const typeColor = TEST_TYPE_COLORS[test_type?.toLowerCase()] || 'bg-gray-100 text-gray-500 border-gray-200'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3 flex-wrap">
        {test_id && (
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">
            {test_id}
          </span>
        )}
        {test_type && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${typeColor}`}>
            {test_type.replace('_', ' ')}
          </span>
        )}
        {linked_requirement_id && (
          <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
            <Link size={9} />
            {linked_requirement_id}
          </span>
        )}
        <h3 className="text-sm font-semibold text-gray-900 w-full">{title || artifact.title}</h3>
      </div>

      {/* Preconditions */}
      {preconditions.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5">
            Preconditions
          </p>
          <ul className="space-y-0.5">
            {preconditions.map((p, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-gray-400 flex-shrink-0">•</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5">
            Test Steps
          </p>
          <ol className="space-y-1">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-xs text-gray-700 leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Expected Result */}
      {expected_result && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-green-700 font-semibold uppercase tracking-wider mb-1">
            Expected Result
          </p>
          <p className="text-xs text-green-800 leading-relaxed">{expected_result}</p>
        </div>
      )}
    </div>
  )
}
