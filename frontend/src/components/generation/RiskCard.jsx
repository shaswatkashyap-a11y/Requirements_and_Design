import { ShieldAlert, User } from 'lucide-react'

const LIKELIHOOD_COLORS = {
  high:   'text-red-600 bg-red-50',
  medium: 'text-orange-600 bg-orange-50',
  low:    'text-green-600 bg-green-50',
}

const IMPACT_COLORS = {
  high:   'text-red-600 bg-red-50',
  medium: 'text-orange-600 bg-orange-50',
  low:    'text-green-600 bg-green-50',
}

function RiskMatrix({ likelihood, impact }) {
  const lColor = LIKELIHOOD_COLORS[likelihood?.toLowerCase()] || 'text-gray-500 bg-gray-50'
  const iColor = IMPACT_COLORS[impact?.toLowerCase()] || 'text-gray-500 bg-gray-50'
  if (!likelihood && !impact) return null
  return (
    <div className="flex items-center gap-2 mb-3">
      {likelihood && (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded capitalize ${lColor}`}>
          {likelihood} Likelihood
        </span>
      )}
      {likelihood && impact && <span className="text-gray-300 text-xs">×</span>}
      {impact && (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded capitalize ${iColor}`}>
          {impact} Impact
        </span>
      )}
    </div>
  )
}

export default function RiskCard({ artifact }) {
  const { risk_id, description, likelihood, impact, mitigation, owner } =
    artifact.content_json || {}

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className="p-1.5 bg-red-50 rounded-lg flex-shrink-0">
          <ShieldAlert size={14} className="text-red-500" />
        </div>
        <div className="min-w-0">
          {risk_id && (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded mr-2">
              {risk_id}
            </span>
          )}
          <h3 className="text-sm font-semibold text-gray-900 mt-1 leading-snug">
            {artifact.title || description}
          </h3>
        </div>
      </div>

      {/* Risk matrix */}
      <RiskMatrix likelihood={likelihood} impact={impact} />

      {/* Description (if separate from title) */}
      {description && description !== artifact.title && (
        <p className="text-xs text-gray-700 leading-relaxed mb-3">{description}</p>
      )}

      {/* Mitigation */}
      {mitigation && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-[11px] text-amber-700 font-semibold uppercase tracking-wider mb-1">
            Mitigation
          </p>
          <p className="text-xs text-amber-800 leading-relaxed">{mitigation}</p>
        </div>
      )}

      {/* Owner */}
      {owner && (
        <div className="flex items-center gap-1.5">
          <User size={11} className="text-gray-400" />
          <span className="text-[11px] text-gray-500">{owner}</span>
        </div>
      )}
    </div>
  )
}
