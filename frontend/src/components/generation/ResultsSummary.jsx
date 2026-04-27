import { useState, useEffect } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { fetchModuleArtifacts } from '../../api/generationApi'

const ARTIFACT_TABS = [
  { type: 'functional_req',    label: 'Functional Req.',  color: 'bg-blue-50 border-blue-200 text-blue-600' },
  { type: 'nonfunctional_req', label: 'Non-Functional',   color: 'bg-indigo-50 border-indigo-200 text-indigo-600' },
  { type: 'task',              label: 'Tasks',             color: 'bg-teal-50 border-teal-200 text-teal-600' },
  { type: 'test_case',         label: 'Test Cases',        color: 'bg-purple-50 border-purple-200 text-purple-600' },
  { type: 'architecture',      label: 'Architecture',      color: 'bg-sky-50 border-sky-200 text-sky-600' },
  { type: 'risk_entry',        label: 'Risks',             color: 'bg-rose-50 border-rose-200 text-rose-600' },
]

export default function ResultsSummary({ run, modules, runId }) {
  // counts[moduleId][artifactType] = number
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Determine which artifact types were actually requested for this run
  const requestedTypes = ARTIFACT_TABS.filter((t) =>
    (run?.artifact_types_requested || []).includes(t.type)
  )

  useEffect(() => {
    if (!modules || modules.length === 0) { setLoading(false); return }

    async function loadAllCounts() {
      setLoading(true)
      const result = {}

      await Promise.all(
        modules.map(async (mod) => {
          result[mod.id] = {}
          await Promise.all(
            requestedTypes.map(async ({ type }) => {
              try {
                const artifacts = await fetchModuleArtifacts(runId, mod.id, type)
                result[mod.id][type] = artifacts.length
              } catch {
                result[mod.id][type] = 0
              }
            })
          )
        })
      )

      setCounts(result)
      setLoading(false)
    }

    loadAllCounts()
  }, [runId, modules?.length])

  // Column totals across all modules
  const typeTotals = {}
  if (counts) {
    for (const { type } of requestedTypes) {
      typeTotals[type] = modules.reduce(
        (sum, mod) => sum + (counts[mod.id]?.[type] ?? 0), 0
      )
    }
  }
  const grandTotal = Object.values(typeTotals).reduce((a, b) => a + b, 0)

  async function handleExportMarkdown() {
    setExporting(true)
    try {
      const allParts = []
      for (const mod of modules) {
        allParts.push(`\n# Module: ${mod.name}\n`)
        if (mod.description) allParts.push(`_${mod.description}_\n`)
        for (const { type, label } of ARTIFACT_TABS) {
          try {
            const artifacts = await fetchModuleArtifacts(runId, mod.id, type)
            if (artifacts.length > 0) {
              allParts.push(`\n## ${label}\n`)
              for (const a of artifacts) {
                allParts.push(a.content_markdown || `### ${a.title}\n\n${JSON.stringify(a.content_json, null, 2)}\n`)
                allParts.push('\n---\n')
              }
            }
          } catch { /* skip */ }
        }
      }
      const blob = new Blob([allParts.join('\n')], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generation-${runId}-artifacts.md`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-10 justify-center">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading artifact counts…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Modules */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{modules.length}</p>
          <p className="text-[11px] text-blue-500 mt-0.5">Modules</p>
        </div>
        {/* Total */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{grandTotal}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Total</p>
        </div>
        {/* Per-type */}
        {requestedTypes.map(({ type, label, color }) => {
          const [bg, border, text] = color.split(' ')
          return (
            <div key={type} className={`${bg} border ${border} rounded-xl px-4 py-3 text-center`}>
              <p className={`text-2xl font-bold ${text}`}>{typeTotals[type] ?? 0}</p>
              <p className={`text-[11px] mt-0.5 ${text}`}>{label}</p>
            </div>
          )
        })}
      </div>

      {/* ── Module × Artifact matrix ─────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Module × Artifact Matrix
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 min-w-[160px]">Module</th>
                {requestedTypes.map(({ label }) => (
                  <th key={label} className="px-3 py-2.5 text-center font-semibold text-gray-500 whitespace-nowrap">
                    {label}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((mod, i) => {
                const rowTotal = requestedTypes.reduce(
                  (sum, { type }) => sum + (counts?.[mod.id]?.[type] ?? 0), 0
                )
                return (
                  <tr key={mod.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2.5 font-medium text-gray-700 max-w-[200px] truncate">
                      {mod.name}
                    </td>
                    {requestedTypes.map(({ type, color }) => {
                      const val = counts?.[mod.id]?.[type] ?? 0
                      const [,, text] = color.split(' ')
                      return (
                        <td key={type} className="px-3 py-2.5 text-center">
                          {val > 0
                            ? <span className={`font-semibold ${text}`}>{val}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      )
                    })}
                    <td className="px-3 py-2.5 text-center font-bold text-gray-700">
                      {rowTotal}
                    </td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr className="bg-gray-100 border-t border-gray-200 font-semibold">
                <td className="px-3 py-2.5 text-gray-700">Total</td>
                {requestedTypes.map(({ type, color }) => {
                  const [,, text] = color.split(' ')
                  return (
                    <td key={type} className={`px-3 py-2.5 text-center font-bold ${text}`}>
                      {typeTotals[type] ?? 0}
                    </td>
                  )
                })}
                <td className="px-3 py-2.5 text-center font-bold text-gray-800">{grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Export ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleExportMarkdown}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded-lg transition-colors disabled:opacity-60"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {exporting ? 'Exporting…' : 'Export Markdown'}
        </button>
        <p className="text-xs text-gray-400">Downloads all artifacts as a single .md file</p>
      </div>

    </div>
  )
}
