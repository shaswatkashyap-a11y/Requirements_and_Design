import { useState, useEffect } from "react"
import { Download, Loader2, CheckCircle } from "lucide-react"
import { fetchModuleArtifacts } from "../../api/generationApi"

const BASE = "http://localhost:8000/api"

// Mirrors ARTIFACT_LABELS in document_builder.py
const ARTIFACT_LABELS = {
  functional_req:    "Functional Requirements",
  nonfunctional_req: "Non-Functional Requirements",
  architecture:      "Architecture",
  task:              "Implementation Tasks",
  test_case:         "Test Cases",
  risk_entry:        "Risk Register",
}

// Mirrors EXTRA_SECTION_ARTIFACT_SOURCE in document_builder.py
const EXTRA_SECTION_ARTIFACT_SOURCE = {
  aws_architecture_overview:      "architecture",
  gcp_architecture_overview:      "architecture",
  azure_architecture_overview:    "architecture",
  api_specification:              "architecture",
  data_model_overview:            "architecture",
  angular_module_structure:       "architecture",
  background_tasks_overview:      "architecture",
  ml_pipeline_architecture:       "architecture",
  agent_architecture:             "architecture",
  data_pipeline_architecture:     "architecture",
  salesforce_object_model:        "architecture",
  governor_limits_analysis:       "nonfunctional_req",
  model_performance_requirements: "nonfunctional_req",
}

// ── Per-artifact preview renderers ───────────────────────────────────────────
// Each mirrors the corresponding _render_* function in document_builder.py.
// content = artifact.content_json (flat dict, one item per artifact record)

function FunctionalReqPreview({ content }) {
  const criteria = Array.isArray(content.acceptance_criteria) ? content.acceptance_criteria : []
  return (
    <div className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {content.req_id && (
          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
            {content.req_id}
          </span>
        )}
        <span className="text-xs font-semibold text-gray-800">{content.title}</span>
        {content.priority && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
            {content.priority}
          </span>
        )}
      </div>
      {content.user_story && (
        <p className="text-[11px] italic text-blue-700 bg-blue-50 border-l-2 border-blue-300 px-2 py-1.5 mb-1.5 rounded-r">
          {content.user_story}
        </p>
      )}
      {content.description && (
        <p className="text-[11px] text-gray-700 leading-relaxed mb-1.5">{content.description}</p>
      )}
      {criteria.length > 0 && (
        <div className="mb-1">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Acceptance Criteria
          </p>
          <ul className="list-disc list-outside pl-4 space-y-0.5">
            {criteria.map((c, i) => (
              <li key={i} className="text-[11px] text-gray-600 leading-snug">{c}</li>
            ))}
          </ul>
        </div>
      )}
      {content.source_section && (
        <p className="text-[10px] text-gray-400 mt-1">SOW Ref: {content.source_section}</p>
      )}
    </div>
  )
}

function NfrPreview({ content }) {
  return (
    <div className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {content.req_id && (
          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">
            {content.req_id}
          </span>
        )}
        {content.category && (
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
            {content.category}
          </span>
        )}
        <span className="text-xs font-semibold text-gray-800">{content.title}</span>
        {content.priority && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
            {content.priority}
          </span>
        )}
      </div>
      {content.description && (
        <p className="text-[11px] text-gray-700 leading-relaxed mb-1">{content.description}</p>
      )}
      {content.measurable_criteria && (
        <p className="text-[11px] text-gray-500">
          <span className="font-semibold">Measurable:</span> {content.measurable_criteria}
        </p>
      )}
    </div>
  )
}

function ArchitecturePreview({ content }) {
  const interfaces   = Array.isArray(content.interfaces)   ? content.interfaces   : []
  const dataEntities = Array.isArray(content.data_entities) ? content.data_entities : []
  return (
    <div className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-xs font-semibold text-gray-800">{content.component_name}</span>
        {content.technology_suggestion && (
          <span className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded">
            {content.technology_suggestion}
          </span>
        )}
      </div>
      {content.description && (
        <p className="text-[11px] text-gray-700 leading-relaxed mb-1">{content.description}</p>
      )}
      {interfaces.length > 0 && (
        <p className="text-[11px] text-gray-500">
          <span className="font-semibold">Interfaces:</span> {interfaces.join(", ")}
        </p>
      )}
      {dataEntities.length > 0 && (
        <p className="text-[11px] text-gray-500">
          <span className="font-semibold">Data Entities:</span> {dataEntities.join(", ")}
        </p>
      )}
    </div>
  )
}

function TaskPreview({ content }) {
  const criteria = Array.isArray(content.acceptance_criteria) ? content.acceptance_criteria : []
  return (
    <div className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {content.task_id && (
          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded">
            {content.task_id}
          </span>
        )}
        {content.task_type && (
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
            {content.task_type}
          </span>
        )}
        <span className="text-xs font-semibold text-gray-800">{content.title}</span>
        {content.estimated_hours != null && (
          <span className="ml-auto text-[10px] text-gray-500">{content.estimated_hours}h</span>
        )}
      </div>
      {content.description && (
        <p className="text-[11px] text-gray-700 leading-relaxed mb-1">{content.description}</p>
      )}
      {content.linked_requirement_id && (
        <p className="text-[11px] text-gray-500 mb-1">Linked: {content.linked_requirement_id}</p>
      )}
      {criteria.length > 0 && (
        <ul className="list-disc list-outside pl-4 space-y-0.5 mt-1">
          {criteria.map((c, i) => (
            <li key={i} className="text-[11px] text-gray-600 leading-snug">{c}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TestCasePreview({ content }) {
  const steps    = Array.isArray(content.steps)        ? content.steps        : []
  const preconds = Array.isArray(content.preconditions) ? content.preconditions : []
  return (
    <div className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {content.test_id && (
          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded">
            {content.test_id}
          </span>
        )}
        {content.test_type && (
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
            {content.test_type}
          </span>
        )}
        <span className="text-xs font-semibold text-gray-800">{content.title}</span>
      </div>
      {content.linked_requirement_id && (
        <p className="text-[11px] text-gray-500 mb-1">Linked: {content.linked_requirement_id}</p>
      )}
      {preconds.length > 0 && (
        <p className="text-[11px] text-gray-500 mb-1">
          <span className="font-semibold">Preconditions:</span> {preconds.join("; ")}
        </p>
      )}
      {steps.length > 0 && (
        <ol className="list-decimal list-outside pl-4 space-y-0.5 mb-1">
          {steps.map((s, i) => (
            <li key={i} className="text-[11px] text-gray-700">{s}</li>
          ))}
        </ol>
      )}
      {content.expected_result && (
        <p className="text-[11px] text-gray-500">
          <span className="font-semibold">Expected:</span> {content.expected_result}
        </p>
      )}
    </div>
  )
}

function RiskPreview({ content }) {
  const LIKELIHOOD_COLORS = {
    high:   "text-red-600 bg-red-50",
    medium: "text-orange-600 bg-orange-50",
    low:    "text-green-600 bg-green-50",
  }
  const IMPACT_COLORS = {
    high:   "text-red-600 bg-red-50",
    medium: "text-orange-600 bg-orange-50",
    low:    "text-green-600 bg-green-50",
  }
  const lColor = LIKELIHOOD_COLORS[content.likelihood?.toLowerCase()] || "text-gray-500 bg-gray-50"
  const iColor = IMPACT_COLORS[content.impact?.toLowerCase()]         || "text-gray-500 bg-gray-50"
  return (
    <div className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {content.risk_id && (
          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded">
            {content.risk_id}
          </span>
        )}
        {content.likelihood && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${lColor}`}>
            {content.likelihood} Likelihood
          </span>
        )}
        {content.impact && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${iColor}`}>
            {content.impact} Impact
          </span>
        )}
      </div>
      {content.description && (
        <p className="text-[11px] text-gray-700 leading-relaxed mb-1">{content.description}</p>
      )}
      {content.mitigation && (
        <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-1">
          <p className="text-[11px] text-amber-800">
            <span className="font-semibold">Mitigation:</span> {content.mitigation}
          </p>
        </div>
      )}
      {content.owner && (
        <p className="text-[11px] text-gray-500">Owner: {content.owner}</p>
      )}
    </div>
  )
}

function renderArtifact(artifact) {
  const c = artifact.content_json || {}
  switch (artifact.artifact_type) {
    case "functional_req":    return <FunctionalReqPreview key={artifact.id} content={c} />
    case "nonfunctional_req": return <NfrPreview           key={artifact.id} content={c} />
    case "architecture":      return <ArchitecturePreview  key={artifact.id} content={c} />
    case "task":              return <TaskPreview          key={artifact.id} content={c} />
    case "test_case":         return <TestCasePreview      key={artifact.id} content={c} />
    case "risk_entry":        return <RiskPreview          key={artifact.id} content={c} />
    default:                  return null
  }
}

// ── Extra-section sub-components (mirror _add_extra_sections logic) ───────────

function ArchitectureSummaryTable({ modules, artifactsByModule }) {
  const rows = []
  for (const mod of modules) {
    for (const art of artifactsByModule[mod.id]?.architecture || []) {
      const c = art.content_json || {}
      rows.push({ module: mod.name, component: c.component_name, technology: c.technology_suggestion })
    }
  }
  if (rows.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">
        No architecture components were generated for this run.
      </p>
    )
  }
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-slate-100">
          <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">Module</th>
          <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">Component</th>
          <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">Technology</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="px-3 py-2 border border-gray-200 text-gray-700">{row.module}</td>
            <td className="px-3 py-2 border border-gray-200 font-medium text-gray-800">{row.component}</td>
            <td className="px-3 py-2 border border-gray-200 text-gray-600">{row.technology}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function NfrSummary({ modules, artifactsByModule }) {
  const hasAny = modules.some(mod => (artifactsByModule[mod.id]?.nonfunctional_req || []).length > 0)
  if (!hasAny) {
    return (
      <p className="text-xs text-gray-400 italic">
        No non-functional requirements were generated for this run.
      </p>
    )
  }
  return (
    <div>
      {modules.map(mod => {
        const arts = artifactsByModule[mod.id]?.nonfunctional_req || []
        if (!arts.length) return null
        return (
          <div key={mod.id} className="mb-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">{mod.name}</p>
            {arts.map(art => <NfrPreview key={art.id} content={art.content_json || {}} />)}
          </div>
        )
      })}
    </div>
  )
}

function ExtraSection({ section, modules, artifactsByModule }) {
  const artSource = EXTRA_SECTION_ARTIFACT_SOURCE[section.id]
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-1 mb-3">
        {section.title}
      </h2>
      {artSource === "architecture" ? (
        <ArchitectureSummaryTable modules={modules} artifactsByModule={artifactsByModule} />
      ) : artSource === "nonfunctional_req" ? (
        <NfrSummary modules={modules} artifactsByModule={artifactsByModule} />
      ) : (
        <p className="text-xs text-gray-400 italic">
          This section is to be completed with project-specific details during project initiation.
          Refer to the detailed requirements and architecture sections for the AI-generated analysis.
        </p>
      )}
    </section>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExportPanel({ run, modules, runId }) {
  const [downloading,    setDownloading]    = useState(false)
  const [lastDownloaded, setLastDownloaded] = useState(null)
  const [downloadError,  setDownloadError]  = useState(null)
  const [artifactsByModule, setArtifactsByModule] = useState({})
  const [config,         setConfig]         = useState(null)
  const [methodConfig,   setMethodConfig]   = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(true)

  // Fetch methodology config + service-line config + all artifacts in one shot
  useEffect(() => {
    if (!modules.length || !run?.methodology) { setLoadingPreview(false); return }
    setLoadingPreview(true)
    async function loadAll() {
      try {
        const [configData, methodConfigData, ...moduleArtifactLists] = await Promise.all([
          fetch(`${BASE}/generation-runs/${runId}/export-config`).then(r => r.json()),
          fetch(`${BASE}/config/methodology/${run.methodology}`).then(r => r.json()),
          ...modules.map(mod => fetchModuleArtifacts(runId, mod.id)),
        ])
        setConfig(configData)
        setMethodConfig(methodConfigData)
        const byModule = {}
        modules.forEach((mod, i) => {
          const byType = {}
          for (const art of moduleArtifactLists[i]) {
            ;(byType[art.artifact_type] ??= []).push(art)
          }
          byModule[mod.id] = byType
        })
        setArtifactsByModule(byModule)
      } catch (err) {
        console.error("Export preview load failed:", err)
      } finally {
        setLoadingPreview(false)
      }
    }
    loadAll()
  }, [runId, modules])

  async function handleDownload(format) {
    if (format === "pdf") {
      window.print()
      return
    }
    setDownloading(true)
    setDownloadError(null)
    try {
      const res = await fetch(`${BASE}/generation-runs/${runId}/export?format=${format}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || "Export failed")
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = `requirements_run_${runId}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      setLastDownloaded(format)
    } catch (err) {
      setDownloadError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  const methodology = run?.methodology || ""

  const terminology         = config?.terminology         || {}
  const extraSections       = config?.extra_sections      || []
  const complianceStandards = config?.compliance_standards || []
  const roles               = config?.roles               || []
  const displayNames        = config?.display_names       || []

  const extraAfterModuleOverview = extraSections.filter(
    s => s.placement === "after" && s.relative_to === "module_overview"
  )
  const extraBeforeAppendix = extraSections.filter(
    s => s.placement === "before" && s.relative_to === "appendix"
  )

  const sowRaw     = (run?.sow?.raw_text || "").trim()
  const sowDisplay = sowRaw.length > 1200 ? sowRaw.slice(0, 1200) + "…" : sowRaw

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #export-print-area, #export-print-area * { visibility: visible; }
          #export-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            overflow: visible;
          }
        }
      `}</style>

      {/* ── Download toolbar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">
          Export
        </span>

        <button
          onClick={() => handleDownload("docx")}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Download DOCX
        </button>

        <button
          onClick={() => handleDownload("pdf")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Download size={12} />
          Print to PDF
        </button>

        {lastDownloaded && !downloading && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle size={12} />
            {lastDownloaded.toUpperCase()} downloaded
          </span>
        )}

        {downloadError && (
          <span className="text-xs text-red-500">{downloadError}</span>
        )}
      </div>

      {/* ── Document preview ── */}
      <div id="export-print-area" className="flex-1 overflow-y-auto p-6">
        {loadingPreview ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={18} className="animate-spin mr-2" />
            <span className="text-sm">Preparing document preview…</span>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">

        {/* ── Cover ── */}
        <div className="px-10 py-10 text-center border-b border-gray-200">
          <div className="flex justify-center mb-6">
            <img src="/jadelogo.png" alt="Jade Global" className="h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {run?.project?.name || `Project Requirements`}
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            {methodConfig?.document_title || "Requirements Document"}
          </p>
          <div className="flex justify-center flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
            <span>
              <span className="font-semibold">Methodology:</span>{" "}
              {methodology ? methodology.charAt(0).toUpperCase() + methodology.slice(1) : "—"}
            </span>
            <span>
              <span className="font-semibold">Service Lines:</span>{" "}
              {displayNames.length ? displayNames.join(", ") : (run?.service_line_codes || []).join(", ") || "—"}
            </span>
            <span>
              <span className="font-semibold">Generated:</span>{" "}
              {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
            <span><span className="font-semibold">Run ID:</span> {runId}</span>
            <span><span className="font-semibold">Status:</span> {run?.status || "—"}</span>
          </div>
        </div>

            <div className="px-10 py-8 space-y-8">

              {/* ── 1. Executive Summary ── */}
              <section>
                <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-1 mb-3">
                  1. Executive Summary
                </h2>
                <p className="text-xs text-gray-700 leading-relaxed mb-3">
                  This document presents the software requirements for{" "}
                  <span className="font-medium">{terminology.system || "the system"}</span>{" "}
                  as understood from the Statement of Work (SOW) provided by the client. It captures
                  the functional requirements, non-functional requirements, module structure, risks,
                  and test cases derived through AI-assisted analysis.
                </p>
                <p className="text-xs font-semibold text-gray-700 mb-1">SOW Summary:</p>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                  {sowDisplay || "No SOW content provided."}
                </p>
              </section>

              {/* ── 2. Module Overview ── */}
              <section>
                <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-1 mb-3">
                  2. Module Overview
                </h2>
                <p className="text-xs text-gray-600 mb-3">
                  The following functional modules were identified from the SOW:
                </p>
                {modules.length === 0 ? (
                  <p className="text-xs text-gray-400">No modules found.</p>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200 w-8">#</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200 w-1/3">Module</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-200">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((mod, idx) => (
                        <tr key={mod.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 border border-gray-200 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2 border border-gray-200 font-medium text-gray-800">{mod.name}</td>
                          <td className="px-3 py-2 border border-gray-200 text-gray-600">{mod.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* ── Extra sections after module_overview ── */}
              {extraAfterModuleOverview.map(s => (
                <ExtraSection
                  key={s.id}
                  section={s}
                  modules={modules}
                  artifactsByModule={artifactsByModule}
                />
              ))}

              {/* ── 3. Detailed Requirements by Module ── */}
              <section>
                <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-1 mb-4">
                  3. Detailed Requirements by Module
                </h2>
                {!methodConfig ? (
                  <p className="text-xs text-red-500">
                    Unsupported or missing methodology "{methodology}" — cannot render section order.
                  </p>
                ) : (
                  modules.map(mod => {
                    const modArts = artifactsByModule[mod.id] || {}
                    return (
                      <div key={mod.id} className="mb-8">
                        <h3 className="text-sm font-bold text-gray-800 mb-1">{mod.name}</h3>
                        {mod.description && (
                          <p className="text-[11px] italic text-gray-500 mb-3">{mod.description}</p>
                        )}
                        {(methodConfig.artifact_order || []).map(artType => {
                          const arts = modArts[artType] || []
                          if (!arts.length) return null
                          const heading =
                            artType === "functional_req"
                              ? methodConfig.functional_req_heading
                              : ARTIFACT_LABELS[artType] || artType
                          return (
                            <div key={artType} className="mb-5">
                              <h4 className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                                {heading}
                              </h4>
                              {arts.map(art => renderArtifact(art))}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                )}
              </section>

              {/* ── 4. Non-Functional Requirements (consolidated across all modules) ── */}
              <section>
                <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-1 mb-4">
                  4. Non-Functional Requirements
                </h2>
                {modules.some(mod => (artifactsByModule[mod.id]?.nonfunctional_req || []).length > 0) ? (
                  modules.map(mod => {
                    const arts = artifactsByModule[mod.id]?.nonfunctional_req || []
                    if (!arts.length) return null
                    return (
                      <div key={mod.id} className="mb-5">
                        <h3 className="text-xs font-bold text-gray-700 mb-2">{mod.name}</h3>
                        {arts.map(art => <NfrPreview key={art.id} content={art.content_json || {}} />)}
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-gray-400">
                    No non-functional requirements were generated for this run.
                  </p>
                )}
              </section>

              {/* ── Extra sections before appendix ── */}
              {extraBeforeAppendix.map(s => (
                <ExtraSection
                  key={s.id}
                  section={s}
                  modules={modules}
                  artifactsByModule={artifactsByModule}
                />
              ))}

              {/* ── Appendix ── */}
              {(complianceStandards.length > 0 || roles.length > 0) && (
                <section>
                  <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-1 mb-4">
                    Appendix
                  </h2>

                  {complianceStandards.length > 0 && (
                    <div className="mb-5">
                      <h3 className="text-xs font-bold text-gray-700 mb-3">
                        A. Applicable Compliance Standards
                      </h3>
                      {complianceStandards.map((std, i) => (
                        <div key={i} className="mb-3">
                          <p className="text-xs font-semibold text-gray-800">{std.name}</p>
                          <p className="text-[11px] text-gray-600 leading-relaxed">{std.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {roles.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-700 mb-3">
                        B. Key Roles &amp; Responsibilities
                      </h3>
                      {roles.map((role, i) => (
                        <div key={i} className="mb-3">
                          <p className="text-xs font-semibold text-gray-800">{role.name}</p>
                          <p className="text-[11px] text-gray-600 leading-relaxed">{role.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ── Footer ── */}
              <div className="border-t border-gray-100 pt-4 text-[10px] text-gray-400 text-center">
                Generated by RD Studio · Run #{runId} · {new Date().toLocaleDateString()}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
