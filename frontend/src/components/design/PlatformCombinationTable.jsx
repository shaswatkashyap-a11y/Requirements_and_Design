import { useState } from 'react'
import { ChevronDown, ChevronUp, GitMerge, Layers } from 'lucide-react'
import { getGroupMeta } from '../../data/serviceLineStandards'

function SlTag({ code }) {
  const groupMap = {
    salesforce: 'CRM & ERP Platforms', netsuite: 'CRM & ERP Platforms',
    sap: 'CRM & ERP Platforms', oracle: 'CRM & ERP Platforms',
    servicenow: 'ITSM & Workflow',
    dotnet: 'Custom Development', python: 'Custom Development', java: 'Custom Development',
    react: 'Frontend Frameworks', angular: 'Frontend Frameworks',
    agentic_ai: 'AI & Intelligence', ai_ml: 'AI & Intelligence', data_ai: 'AI & Intelligence',
    azure: 'Cloud Platforms', aws: 'Cloud Platforms', gcp: 'Cloud Platforms',
  }
  const meta = getGroupMeta(groupMap[code] || '')
  return (
    <span
      className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-medium ${
        meta.bg || 'bg-gray-50'
      } ${meta.color || 'text-gray-600'} ${meta.border || 'border-gray-200'}`}
    >
      {code}
    </span>
  )
}

function ComboDetailPanel({ combo, onClose }) {
  return (
    <div className="border-t border-indigo-100 bg-indigo-50 p-5 rounded-b-xl">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-bold text-indigo-700">{combo.id} — {combo.use_case}</p>
          <p className="text-[11px] text-indigo-500 mt-0.5">Architecture: {combo.architecture_style}</p>
        </div>
        <button onClick={onClose} className="text-indigo-400 hover:text-indigo-600 text-[11px]">
          Close ✕
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Integration Patterns */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <GitMerge size={12} className="text-indigo-400" />
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Integration Patterns</p>
          </div>
          <ul className="space-y-2">
            {combo.integration_patterns.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-gray-700 bg-white rounded-lg p-2 border border-indigo-100">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold mt-0.5">
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Typical Use */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={12} className="text-indigo-400" />
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Typical Use Case</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-indigo-100 text-[11px] text-gray-700 leading-relaxed">
            {combo.typical_use}
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Service Lines</p>
            <div className="flex flex-wrap gap-1.5">
              {combo.service_lines.map((sl) => (
                <SlTag key={sl} code={sl} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlatformCombinationTable({ combinations, highlightedCodes = [] }) {
  const [selectedId, setSelectedId] = useState(null)

  const toggle = (id) => setSelectedId((prev) => (prev === id ? null : id))

  const isHighlighted = (combo) =>
    highlightedCodes.length > 0 &&
    combo.service_lines.some((sl) => highlightedCodes.includes(sl))

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="col-span-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ID</p>
        </div>
        <div className="col-span-5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Service Lines</p>
        </div>
        <div className="col-span-5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Use Case</p>
        </div>
        <div className="col-span-1" />
      </div>

      {/* Rows */}
      {combinations.map((combo) => {
        const active = selectedId === combo.id
        const highlighted = isHighlighted(combo)
        return (
          <div key={combo.id} className={`border-b border-gray-100 last:border-0 ${highlighted ? 'bg-indigo-50/40' : ''}`}>
            <button
              onClick={() => toggle(combo.id)}
              className={`w-full grid grid-cols-12 gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors ${active ? 'bg-indigo-50' : ''}`}
            >
              {/* ID */}
              <div className="col-span-1 flex items-center">
                <span className={`text-xs font-bold ${highlighted ? 'text-indigo-600' : 'text-blue-600'}`}>
                  {combo.id}
                </span>
              </div>

              {/* Service Lines */}
              <div className="col-span-5 flex items-center">
                <div className="flex flex-wrap gap-1.5">
                  {combo.service_lines.map((sl) => (
                    <SlTag key={sl} code={sl} />
                  ))}
                </div>
              </div>

              {/* Use Case */}
              <div className="col-span-5 flex items-center">
                <p className={`text-xs ${highlighted ? 'text-indigo-700 font-medium' : 'text-orange-600'}`}>
                  {combo.use_case}
                </p>
              </div>

              {/* Expand */}
              <div className="col-span-1 flex items-center justify-end">
                {active ? (
                  <ChevronUp size={14} className="text-indigo-400" />
                ) : (
                  <ChevronDown size={14} className="text-gray-300" />
                )}
              </div>
            </button>

            {active && (
              <ComboDetailPanel combo={combo} onClose={() => setSelectedId(null)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
