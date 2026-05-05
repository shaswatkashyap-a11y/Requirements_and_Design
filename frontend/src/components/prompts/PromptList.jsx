import { useRef, useLayoutEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const TYPE_LABELS = {
  base:                'Base Templates',
  methodology:         'Methodology',
  service_line:        'Service Line',
  refinement:          'Refinement',
  methodology_config:  'Methodology Config',
  service_line_config: 'Service Line Config',
}

function getConceptLabel(row) {
  return row.scope_key || row.artifact_type || row.section || 'global'
}

export default function PromptList({ prompts, selectedId, onSelect }) {
  const scrollRef    = useRef(null)
  const scrollTopRef = useRef(0)

  const grouped = prompts.reduce((acc, p) => {
    acc[p.prompt_type] = acc[p.prompt_type] || []
    acc[p.prompt_type].push(p)
    return acc
  }, {})

  const [openSections, setOpenSections] = useState(
    () => Object.fromEntries(Object.keys(grouped).map((k) => [k, false]))
  )

  function toggle(type) {
    setOpenSections((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollTopRef.current
    }
  })

  return (
    <div
      ref={scrollRef}
      onScroll={() => { scrollTopRef.current = scrollRef.current?.scrollTop ?? 0 }}
      className="w-56 flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white"
    >
      {Object.entries(grouped).map(([type, rows]) => (
        <div key={type}>
          <button
            onClick={() => toggle(type)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <span>{TYPE_LABELS[type] || type}</span>
            {openSections[type]
              ? <ChevronUp size={11} className="text-gray-400" />
              : <ChevronDown size={11} className="text-gray-400" />
            }
          </button>

          {openSections[type] && rows.map((row) => {
            let badge, badgeClass
            if (!row.project_id) {
              badge      = 'global'
              badgeClass = 'bg-gray-100 text-gray-400'
            } else if (row.is_active) {
              badge      = 'override'
              badgeClass = 'bg-indigo-100 text-indigo-600'
            } else {
              badge      = 'override · off'
              badgeClass = 'bg-amber-100 text-amber-600'
            }

            return (
              <button
                key={row.id}
                onClick={() => onSelect(row)}
                className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selectedId === row.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {getConceptLabel(row)}
                  </p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${badgeClass}`}>
                    {badge}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
