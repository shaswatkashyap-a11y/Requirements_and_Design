import { useDispatch, useSelector } from 'react-redux'
import {
  setValidationLoading,
  setValidationResult,
  setValidationError,
  clearValidationResult,
} from '../../store/slices/validationSlice'
import { triggerValidation } from '../../api/generationApi'
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'


function scoreBadgeClass(label) {
  if (label === 'PASS') return 'bg-green-100 text-green-700 border border-green-200'
  if (label === 'WARN') return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
  return 'bg-red-100 text-red-700 border border-red-200'
}

function ScoreLabel({ score, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${scoreBadgeClass(label)}`}>
      {score.toFixed(1)} — {label}
    </span>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default function ValidationReport({ runId }) {
  const dispatch = useDispatch()
  const result  = useSelector((state) => state.validation.resultsByRun[runId])
  const loading = useSelector((state) => state.validation.loadingByRun[runId] || false)
  const error   = useSelector((state) => state.validation.errorByRun[runId] || null)

  async function handleRun() {
    dispatch(setValidationLoading({ runId }))
    try {
      const data = await triggerValidation(runId)
      dispatch(setValidationResult({ runId, data }))
    } catch (err) {
      dispatch(setValidationError({ runId, error: err.message || 'Validation failed.' }))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Running validation — this may take a few minutes…</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ShieldCheck size={40} className="text-indigo-400" />
        <p className="text-sm text-gray-500 text-center max-w-xs">
          Run an LLM-powered validation to check relevance, traceability, and completeness of all generated artifacts.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            <AlertCircle size={13} /> {error}
          </div>
        )}
        <button
          onClick={handleRun}
          style={{ backgroundColor: '#4f46e5', color: 'white' }}
          className="px-4 py-2 text-sm font-medium rounded-lg"
        >
          Run Validation
        </button>
      </div>
    )
  }

  const { structure, traceability, module_relevance, artifact_relevance, completeness, overall_score, overall_label } = result

  const artByModule = {}
  for (const r of artifact_relevance) {
    if (!artByModule[r.module_id]) artByModule[r.module_id] = []
    artByModule[r.module_id].push(r)
  }

  return (
    <div className="max-w-4xl mx-auto">

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-gray-800">Validation Report</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Overall Score</span>
          <ScoreLabel score={overall_score} label={overall_label} />
          <button
            onClick={handleRun}
            className="ml-4 px-3 py-1.5 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
          >
            Re-run
          </button>
        </div>
      </div>

      <SectionCard title="Structure Check">
        <div className="flex items-center gap-2 mb-2">
          {structure.passed
            ? <CheckCircle2 size={14} className="text-green-500" />
            : <XCircle size={14} className="text-red-500" />}
          <span className="text-xs font-medium text-gray-600">
            {structure.passed ? 'No structural issues found' : `${structure.issues.length} issue(s) found`}
          </span>
        </div>
        {structure.issues.map((issue, i) => (
          <p key={i} className="text-xs text-red-600 ml-5 mt-1">— {issue}</p>
        ))}
      </SectionCard>

      <SectionCard title="Traceability Check">
        <div className="flex items-center gap-2 mb-2">
          {traceability.passed
            ? <CheckCircle2 size={14} className="text-green-500" />
            : <AlertTriangle size={14} className="text-yellow-500" />}
          <span className="text-xs font-medium text-gray-600">
            {traceability.broken_links} broken / {traceability.total_links_checked} links checked
          </span>
        </div>
        {traceability.issues.map((issue, i) => (
          <p key={i} className="text-xs text-red-600 ml-5 mt-1">— {issue}</p>
        ))}
      </SectionCard>

      <SectionCard title="Module Relevance">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Module</th>
              <th className="text-left pb-2 font-medium">Score</th>
              <th className="text-left pb-2 font-medium">Critique</th>
            </tr>
          </thead>
          <tbody>
            {module_relevance.map((r) => (
              <tr key={r.module_id} className="border-b border-gray-50 last:border-0">
                <td className="py-2 pr-4 font-medium text-gray-700 w-1/3">{r.module_name}</td>
                <td className="py-2 pr-4 w-24"><ScoreLabel score={r.score} label={r.score >= 6 ? 'PASS' : r.score >= 4 ? 'WARN' : 'FAIL'} /></td>
                <td className="py-2 text-gray-500">{r.critique}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Artifact Relevance">
        {module_relevance.map((mod) => {
          const rows = artByModule[mod.module_id] || []
          if (!rows.length) return null
          return (
            <div key={mod.module_id} className="mb-4 last:mb-0">
              <p className="text-xs font-semibold text-gray-600 mb-2">{mod.module_name}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-1.5 font-medium">Type</th>
                    <th className="text-left pb-1.5 font-medium">Score</th>
                    <th className="text-left pb-1.5 font-medium">Critique</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 pr-4 text-gray-600 w-36">{r.artifact_type}</td>
                      <td className="py-1.5 pr-4 w-24"><ScoreLabel score={r.score} label={r.score >= 6 ? 'PASS' : r.score >= 4 ? 'WARN' : 'FAIL'} /></td>
                      <td className="py-1.5 text-gray-500">{r.critique}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </SectionCard>

      <SectionCard title="Completeness">
        {completeness.map((r) => (
          <div key={r.module_id} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b border-gray-50 last:border-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-600">{r.module_name}</span>
              <ScoreLabel score={r.score} label={r.score >= 6 ? 'PASS' : r.score >= 4 ? 'WARN' : 'FAIL'} />
            </div>
            {r.gaps.map((gap, i) => (
              <p key={i} className="text-xs text-orange-600 mt-1 ml-2">GAP: {String(gap)}</p>
            ))}
            {r.recommendations.map((rec, i) => (
              <p key={i} className="text-xs text-blue-600 mt-1 ml-2">REC: {String(rec)}</p>
            ))}
          </div>
        ))}
      </SectionCard>

    </div>
  )
}
