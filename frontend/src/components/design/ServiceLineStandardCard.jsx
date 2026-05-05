import { useState } from 'react'
import { Code2, ChevronDown, ChevronUp, FolderTree, Cpu, ShieldCheck, Puzzle } from 'lucide-react'
import { getGroupMeta } from '../../data/serviceLineStandards'

function Section({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={12} className="text-gray-400" />
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      {children}
    </div>
  )
}

export default function ServiceLineStandardCard({ standard, highlighted = false }) {
  const [expanded, setExpanded] = useState(false)
  const groupMeta = getGroupMeta(standard.group)

  return (
    <div
      className={`bg-white rounded-xl border transition-all ${
        highlighted
          ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-md'
          : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
      }`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${groupMeta.bg || 'bg-gray-50'}`}>
            <Code2 size={15} className={groupMeta.color || 'text-gray-500'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">{standard.name}</p>
              {highlighted && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 uppercase tracking-wide">
                  Used in project
                </span>
              )}
            </div>
            <p className={`text-[10px] font-medium mt-0.5 ${groupMeta.color || 'text-gray-500'}`}>
              {standard.code}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-1">{standard.description}</p>
        <p className="text-[11px] text-gray-400 italic">{standard.subtext}</p>

        {/* Tech pills */}
        <div className="flex flex-wrap gap-1 mt-3">
          {standard.tech.map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center gap-1 py-2 border-t border-gray-100 text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors rounded-b-xl"
      >
        {expanded ? (
          <>
            <ChevronUp size={12} /> Hide details
          </>
        ) : (
          <>
            <ChevronDown size={12} /> View patterns, folder structure & NFRs
          </>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50 rounded-b-xl">
          {/* Design Patterns */}
          <Section icon={Puzzle} label="Design Patterns">
            <div className="space-y-2">
              {standard.patterns.map((p) => (
                <div key={p.name} className="flex gap-2">
                  <span className="text-[10px] font-semibold text-gray-700 w-32 flex-shrink-0 leading-relaxed">
                    {p.name}
                  </span>
                  <span className="text-[10px] text-gray-500 leading-relaxed">{p.desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Folder Structure */}
          <Section icon={FolderTree} label="Default Folder Structure">
            <pre className="text-[10px] text-gray-600 bg-white rounded-lg border border-gray-200 p-3 overflow-x-auto leading-relaxed font-mono">
              {standard.folder}
            </pre>
          </Section>

          {/* Key Components */}
          <Section icon={Cpu} label="Key Components">
            <div className="flex flex-wrap gap-1.5">
              {standard.key_components.map((c) => (
                <span key={c} className="text-[10px] px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 font-medium">
                  {c}
                </span>
              ))}
            </div>
          </Section>

          {/* NFR Baselines */}
          <Section icon={ShieldCheck} label="NFR Baselines">
            <ul className="space-y-1">
              {standard.nfr.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-[10px] text-gray-600">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                  {n}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </div>
  )
}
