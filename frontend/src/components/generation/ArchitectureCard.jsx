import { Cpu, Database, Zap } from 'lucide-react'

export default function ArchitectureCard({ artifact }) {
  const {
    component_name,
    description,
    technology_suggestion,
    interfaces = [],
    data_entities = [],
  } = artifact.content_json || {}

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-50 rounded-lg">
            <Cpu size={14} className="text-sky-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">{component_name || artifact.title}</h3>
        </div>
        {technology_suggestion && (
          <span className="text-[11px] font-semibold px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded flex-shrink-0">
            {technology_suggestion}
          </span>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-gray-700 leading-relaxed mb-3">{description}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Interfaces */}
        {interfaces.length > 0 && (
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={11} className="text-gray-400" />
              <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
                Interfaces
              </p>
            </div>
            <ul className="space-y-1">
              {interfaces.map((iface, i) => (
                <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                  <span className="text-gray-300">→</span>
                  {typeof iface === 'string' ? iface : JSON.stringify(iface)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Data Entities */}
        {data_entities.length > 0 && (
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Database size={11} className="text-gray-400" />
              <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
                Data Entities
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {data_entities.map((entity, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600"
                >
                  {typeof entity === 'string' ? entity : JSON.stringify(entity)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
