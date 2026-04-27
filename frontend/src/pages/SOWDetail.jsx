import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Loader2, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react'
import { fetchSOW, parseSOW, fetchProject } from '../api/projectsApi'
import GenerateTab from '../components/generation/GenerateTab'

const SECTION_TYPE_META = {
  executive_summary:      { label: 'Executive Summary',      color: 'bg-purple-100 text-purple-700 border-purple-200' },
  scope:                  { label: 'Scope',                   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  objectives:             { label: 'Objectives',              color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  requirements:           { label: 'Requirements',            color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  deliverables:           { label: 'Deliverables',            color: 'bg-teal-100 text-teal-700 border-teal-200' },
  timeline:               { label: 'Timeline',                color: 'bg-green-100 text-green-700 border-green-200' },
  technical_approach:     { label: 'Technical Approach',      color: 'bg-sky-100 text-sky-700 border-sky-200' },
  roles_responsibilities: { label: 'Roles & Responsibilities', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  assumptions_constraints:{ label: 'Assumptions & Constraints', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  acceptance_criteria:    { label: 'Acceptance Criteria',     color: 'bg-lime-100 text-lime-700 border-lime-200' },
  budget_pricing:         { label: 'Budget & Pricing',        color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  terms_conditions:       { label: 'Terms & Conditions',      color: 'bg-rose-100 text-rose-700 border-rose-200' },
  change_management:      { label: 'Change Management',       color: 'bg-pink-100 text-pink-700 border-pink-200' },
  communication:          { label: 'Communication',           color: 'bg-violet-100 text-violet-700 border-violet-200' },
  appendix:               { label: 'Appendix',                color: 'bg-gray-100 text-gray-600 border-gray-200' },
  unknown:                { label: 'Uncategorized',           color: 'bg-gray-100 text-gray-400 border-gray-200' },
}

function getTypeMeta(type) {
  return SECTION_TYPE_META[type] || SECTION_TYPE_META.unknown
}

function ConfidenceBadge({ score }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'text-green-600' : pct >= 45 ? 'text-yellow-600' : 'text-gray-400'
  return <span className={`text-[10px] font-medium ${color}`}>{pct}%</span>
}

function MetaCard({ label, value }) {
  if (!value) return null
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs text-gray-800 font-medium truncate">{value}</p>
    </div>
  )
}

// ── TAB: OVERVIEW ─────────────────────────────────────────────────────────────
function OverviewTab({ sow, projectId, onReparseSuccess }) {
  const [reparsing, setReparsing] = useState(false)
  const [reparseError, setReparseError] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleReparse() {
    setShowConfirm(false)
    setReparsing(true)
    setReparseError(null)
    try {
      await parseSOW(projectId, sow.id)
      onReparseSuccess()
    } catch {
      setReparseError('Re-parse failed. Please try again.')
    } finally {
      setReparsing(false)
    }
  }

  const meta = sow.metadata_json || {}
  const grouped = {}
  for (const s of sow.sections || []) {
    const t = s.section_type || 'unknown'
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(s)
  }

  const metaFields = [
    { label: 'Project Name', value: meta.project_name },
    { label: 'Client',       value: meta.client },
    { label: 'Vendor',       value: meta.vendor },
    { label: 'Date',         value: meta.date },
    { label: 'Version',      value: meta.version },
    { label: 'Contract No.', value: meta.contract_number },
  ].filter((f) => f.value)

  return (
    <div className="space-y-6">
      {/* Re-parse controls */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          {reparseError && (
            <span className="text-xs text-red-500">{reparseError}</span>
          )}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={reparsing}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 bg-white hover:border-gray-300 hover:text-gray-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {reparsing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {reparsing ? 'Re-parsing…' : 'Re-parse SOW'}
          </button>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Re-parse SOW?</h3>
            <p className="text-xs text-gray-600 mb-5">
              Re-parse will re-process the document with the latest classification rules.
              Previous sections will be replaced. Continue?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReparse}
                className="px-4 py-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
              >
                Re-parse
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      {metaFields.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Document Metadata
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {metaFields.map((f) => (
              <MetaCard key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{(sow.sections || []).length}</p>
          <p className="text-[11px] text-blue-500 mt-0.5">Sections</p>
        </div>
        <div className="bg-teal-50 border border-teal-100 rounded-lg px-4 py-3 text-center">
          <p className="text-2xl font-bold text-teal-600">{(sow.tables || []).length}</p>
          <p className="text-[11px] text-teal-500 mt-0.5">Tables</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3 text-center">
          <p className="text-2xl font-bold text-purple-600">{Object.keys(grouped).length}</p>
          <p className="text-[11px] text-purple-500 mt-0.5">Categories</p>
        </div>
      </div>

      {/* Section categories */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Detected Sections by Category
        </h3>
        <div className="space-y-2">
          {Object.entries(grouped).map(([type, sections]) => {
            const meta = getTypeMeta(type)
            return (
              <div key={type} className="border border-gray-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-gray-400">{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sections.map((s) => (
                    <span key={s.id} className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                      {s.title}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── TAB: SECTIONS ─────────────────────────────────────────────────────────────
function SectionsTab({ sow }) {
  const sections = sow.sections || []
  const [selected, setSelected] = useState(sections[0] || null)
  const [filter, setFilter] = useState('all')

  const types = ['all', ...new Set(sections.map((s) => s.section_type || 'unknown'))]
  const visible = filter === 'all' ? sections : sections.filter((s) => (s.section_type || 'unknown') === filter)

  useEffect(() => {
    if (visible.length > 0 && (!selected || !visible.find((s) => s.id === selected.id))) {
      setSelected(visible[0])
    }
  }, [filter])

  if (sections.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-12">No sections found.</p>
  }

  return (
    <div className="flex gap-4 h-full min-h-0" style={{ height: 'calc(100vh - 260px)' }}>
      {/* Left: section list */}
      <div className="w-64 flex-shrink-0 flex flex-col border border-gray-200 rounded-lg overflow-hidden">
        {/* Filter */}
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 outline-none"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? 'All categories' : getTypeMeta(t).label}
              </option>
            ))}
          </select>
        </div>
        {/* List */}
        <div className="overflow-y-auto flex-1">
          {visible.map((s) => {
            const isActive = selected?.id === s.id
            const indent = Math.max(0, (s.level || 1) - 1) * 12
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors ${
                  isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                }`}
                style={{ paddingLeft: `${12 + indent}px` }}
              >
                <p className={`text-xs leading-snug truncate ${isActive ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                  {s.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] px-1.5 py-0 rounded border ${getTypeMeta(s.section_type).color}`}>
                    {getTypeMeta(s.section_type).label}
                  </span>
                  <ConfidenceBadge score={s.confidence} />
                  {s.page_number && (
                    <span className="text-[9px] text-gray-400">p.{s.page_number}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: section content */}
      <div className="flex-1 border border-gray-200 rounded-lg overflow-y-auto">
        {selected ? (
          <div className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-gray-900 mb-1">{selected.title}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getTypeMeta(selected.section_type).color}`}>
                    {getTypeMeta(selected.section_type).label}
                  </span>
                  <ConfidenceBadge score={selected.confidence} />
                  {selected.page_number && (
                    <span className="text-[10px] text-gray-400">Page {selected.page_number}</span>
                  )}
                  <span className="text-[10px] text-gray-400">Level {selected.level}</span>
                </div>
              </div>
            </div>
            {selected.content ? (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed font-sans bg-gray-50 border border-gray-100 rounded-lg p-4">
                  {selected.content}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No content available for this section.</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Select a section to view its content</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TAB: TABLES ───────────────────────────────────────────────────────────────
function TablesTab({ sow }) {
  const tables = sow.tables || []

  if (tables.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-12">No tables found in this document.</p>
  }

  return (
    <div className="space-y-5">
      {tables.map((t, i) => (
        <div key={t.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">Table {i + 1}</span>
            {t.parent_section && (
              <>
                <ChevronRight size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500">{t.parent_section}</span>
              </>
            )}
            <span className="ml-auto text-[10px] text-gray-400">{t.num_rows} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              {t.headers && t.headers.length > 0 && (
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {t.headers.map((h, hi) => (
                      <th key={hi} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                        {h || '—'}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {(t.rows || []).map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-gray-700 border-b border-gray-100 align-top">
                        {cell || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── TAB: RAW TEXT ─────────────────────────────────────────────────────────────
function RawTextTab({ sow }) {
  const [mode, setMode] = useState('markdown')
  const text = mode === 'markdown' ? sow.markdown_text : sow.raw_text

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {['markdown', 'raw'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              mode === m
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {m === 'markdown' ? 'Markdown' : 'Raw Text'}
          </button>
        ))}
      </div>
      {text ? (
        <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-y-auto font-mono"
          style={{ maxHeight: 'calc(100vh - 320px)' }}>
          {text}
        </pre>
      ) : (
        <p className="text-sm text-gray-400 text-center py-12">No text content available.</p>
      )}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Sections', 'Tables', 'Raw Text', 'Generate']

export default function SOWDetail() {
  const { projectId, sowId } = useParams()
  const navigate = useNavigate()
  const [sow, setSow] = useState(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('Overview')

  async function load() {
    setLoading(true)
    try {
      const [sowData, projectData] = await Promise.all([
        fetchSOW(projectId, sowId),
        fetchProject(projectId).catch(() => null),
      ])
      setSow(sowData)
      setProject(projectData)
    } catch {
      setError('Failed to load SOW data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [projectId, sowId])

  return (
    <div className="p-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/requirement-studio')}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-5 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Projects
      </button>

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          <span className="text-sm">Loading SOW...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {sow && (
        <>
          {/* Header */}
          <div className="flex items-start gap-3 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText size={20} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">{sow.filename}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  sow.status === 'parsed' || sow.status === 'completed'
                    ? 'bg-green-50 text-green-600 border-green-200'
                    : sow.status === 'failed'
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                }`}>
                  {sow.status?.toUpperCase()}
                </span>
                <span className="text-[11px] text-gray-400">
                  {(sow.sections || []).length} sections · {(sow.tables || []).length} tables
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-200 mb-5">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'Overview'  && <OverviewTab  sow={sow} projectId={projectId} onReparseSuccess={load} />}
          {activeTab === 'Sections'  && <SectionsTab  sow={sow} />}
          {activeTab === 'Tables'    && <TablesTab    sow={sow} />}
          {activeTab === 'Raw Text'  && <RawTextTab   sow={sow} />}
          {activeTab === 'Generate'  && <GenerateTab  projectId={projectId} sowId={sowId} project={project} />}
        </>
      )}
    </div>
  )
}