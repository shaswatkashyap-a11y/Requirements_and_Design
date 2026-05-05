import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Loader2, AlertCircle,
  Layers, LayoutGrid, Wand2, Info,
  RefreshCw, Trash2, CheckCircle2, FileDown,
  Pencil, X, Save, History, RotateCcw,
  GitBranch, ArrowLeftRight, Globe, Database, Network, Cpu,
} from 'lucide-react'
import { fetchProject } from '../api/projectsApi'
import { fetchProjectGenerations } from '../api/generationApi'
import { fetchProjectLatestDesign, fetchProjectDesignHistory } from '../api/designApi'
import {
  startLLDGeneration,
  fetchProjectLatestLLD,
  fetchLLDArtifacts,
  deleteLLDRun,
  regenerateLLDSection,
  updateLLDArtifact,
  fetchLLDSectionVersions,
  restoreLLDSectionVersion,
} from '../api/lldApi'
import { useLLDPolling } from '../hooks/useLLDPolling'
import ServiceLineStandardCard from '../components/design/ServiceLineStandardCard'
import PlatformCombinationTable from '../components/design/PlatformCombinationTable'
import { filterByProject, SERVICE_LINE_GROUPS } from '../data/serviceLineStandards'
import { findMatchingCombos } from '../data/platformCombinations'

// ── Section metadata ──────────────────────────────────────────────────────────

const LLD_SECTION_META = [
  {
    key: 'class_diagram',
    label: 'Class Diagram',
    icon: GitBranch,
    description: 'Classes, interfaces, attributes, methods, and inheritance/composition relationships.',
  },
  {
    key: 'sequence_diagrams',
    label: 'Sequence Diagrams',
    icon: ArrowLeftRight,
    description: 'Step-by-step message flows between objects for each key use case.',
  },
  {
    key: 'api_spec',
    label: 'API Specification',
    icon: Globe,
    description: 'Detailed endpoint contracts — URL, method, request/response schema, status codes, auth.',
  },
  {
    key: 'db_schema',
    label: 'Database Schema',
    icon: Database,
    description: 'Table definitions, column types, primary/foreign keys, indexes, and constraints.',
  },
  {
    key: 'integration_mapping',
    label: 'Integration Mapping',
    icon: Network,
    description: 'Field-level mappings between systems, transformation rules, and sync direction.',
  },
  {
    key: 'business_logic',
    label: 'Business Logic',
    icon: Cpu,
    description: 'Core algorithms, validation rules, calculation formulas, and decision flows.',
  },
]

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatTimestamp(isoString) {
  if (!isoString) return null
  const d = new Date(isoString)
  const diffMs  = Date.now() - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr  = Math.floor(diffMs / 3600000)
  const relative =
    diffMin < 1  ? 'just now' :
    diffMin < 60 ? `${diffMin}m ago` :
    diffHr  < 24 ? `${diffHr}h ago` :
    `${Math.floor(diffHr / 24)}d ago`
  const abs = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return { relative, abs }
}

function ServiceLineTag({ code }) {
  return (
    <span className="text-[10px] px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-200 font-medium">
      {code}
    </span>
  )
}

function InfoBanner({ icon: Icon, color, children }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 mb-5 ${color}`}>
      <Icon size={15} className="flex-shrink-0 mt-0.5" />
      <p className="text-xs leading-relaxed">{children}</p>
    </div>
  )
}

// ── Markdown renderer (reused from HLD) ──────────────────────────────────────

function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
        if (p.startsWith('`') && p.endsWith('`'))
          return <code key={i} className="bg-gray-100 text-violet-600 px-1 py-0.5 rounded text-[11px] font-mono">{p.slice(1, -1)}</code>
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

function MdTable({ lines }) {
  const isSep = (l) => /^[\|\-\:\s]+$/.test(l)
  const data = lines.filter((l) => !isSep(l))
  if (data.length === 0) return null
  const parseRow = (l) => l.split('|').slice(1, -1).map((c) => c.trim())
  const [header, ...rows] = data
  return (
    <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-violet-50 border-b border-violet-200">
            {parseRow(header).map((h, i) => (
              <th key={i} className="text-left px-3 py-2.5 text-violet-700 font-semibold whitespace-nowrap">
                <Inline text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={`border-b border-gray-100 last:border-0 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              {parseRow(row).map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-700 leading-relaxed align-top">
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MarkdownContent({ content }) {
  const blocks = []
  const lines  = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      i++
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      continue
    }
    if (line.startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].startsWith('|')) { tableLines.push(lines[i]); i++ }
      blocks.push({ type: 'table', lines: tableLines })
      continue
    }
    blocks.push({ type: 'line', content: line })
    i++
  }

  return (
    <div className="max-w-none">
      {blocks.map((block, idx) => {
        if (block.type === 'code') return (
          <pre key={idx} className="bg-gray-900 text-emerald-400 rounded-xl p-4 text-[11px] font-mono overflow-x-auto my-4 leading-relaxed whitespace-pre">
            {block.content}
          </pre>
        )
        if (block.type === 'table') return <MdTable key={idx} lines={block.lines} />

        const ln = block.content
        if (ln.startsWith('#### ')) return <h4 key={idx} className="text-xs font-bold text-gray-800 mt-5 mb-1.5"><Inline text={ln.slice(5)} /></h4>
        if (ln.startsWith('### ')) return (
          <h3 key={idx} className="text-sm font-bold text-gray-900 mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-violet-400 rounded-full flex-shrink-0" />
            <Inline text={ln.slice(4)} />
          </h3>
        )
        if (ln.startsWith('## ')) return (
          <h2 key={idx} className="text-base font-bold text-gray-900 mt-7 mb-3 pb-2 border-b-2 border-violet-100">
            <Inline text={ln.slice(3)} />
          </h2>
        )
        if (ln.startsWith('# ')) return <h1 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-3"><Inline text={ln.slice(2)} /></h1>
        if (ln.startsWith('- ') || ln.startsWith('* ') || ln.startsWith('• ')) {
          const text = ln.replace(/^[-*•] /, '')
          return (
            <div key={idx} className="flex gap-2 text-xs text-gray-700 mb-1.5 leading-relaxed">
              <span className="text-violet-400 flex-shrink-0 mt-0.5 font-bold">▸</span>
              <span><Inline text={text} /></span>
            </div>
          )
        }
        if (ln.trim() === '') return <div key={idx} className="h-3" />
        return <p key={idx} className="text-xs text-gray-700 leading-relaxed mb-1"><Inline text={ln} /></p>
      })}
    </div>
  )
}

// ── LLD Section Viewer ────────────────────────────────────────────────────────

function LLDViewer({ artifacts, runId, onSectionRegenerated }) {
  const [activeSection,    setActiveSection]    = useState(LLD_SECTION_META[0].key)
  const [regenerating,     setRegenerating]     = useState(null)
  const [regeneratingAll,  setRegeneratingAll]  = useState(false)
  const [regenAllProgress, setRegenAllProgress] = useState(0)
  const [showRegenInput,   setShowRegenInput]   = useState(false)
  const [regenInstruction, setRegenInstruction] = useState('')
  const [editing,          setEditing]          = useState(false)
  const [editContent,      setEditContent]      = useState('')
  const [saving,           setSaving]           = useState(false)
  const [actionError,      setActionError]      = useState(null)
  const [copied,           setCopied]           = useState(false)
  const [showHistory,      setShowHistory]      = useState(false)
  const [versions,         setVersions]         = useState([])
  const [versionsLoading,  setVersionsLoading]  = useState(false)
  const [restoring,        setRestoring]        = useState(null)

  const artifactMap = Object.fromEntries(artifacts.map((a) => [a.section_type, a]))
  const current     = artifactMap[activeSection]
  const meta        = LLD_SECTION_META.find((s) => s.key === activeSection)

  const switchSection = (key) => {
    if (editing) return
    setActiveSection(key)
    setActionError(null)
    setShowRegenInput(false)
    setRegenInstruction('')
    setShowHistory(false)
    setVersions([])
  }

  const handleEdit = () => {
    setEditContent(current.content_markdown)
    setEditing(true)
    setActionError(null)
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setEditContent('')
    setActionError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setActionError(null)
    try {
      const updated = await updateLLDArtifact(runId, activeSection, editContent)
      onSectionRegenerated(updated)
      setEditing(false)
      setEditContent('')
    } catch (err) {
      setActionError(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(activeSection)
    setActionError(null)
    setShowRegenInput(false)
    try {
      const updated = await regenerateLLDSection(runId, activeSection, regenInstruction || null)
      onSectionRegenerated(updated)
      setRegenInstruction('')
    } catch (err) {
      setActionError(`Regenerate failed: ${err.message}`)
    } finally {
      setRegenerating(null)
    }
  }

  const handleRegenerateAll = async () => {
    if (!window.confirm('Regenerate all 6 LLD sections? This will take a few minutes.')) return
    setRegeneratingAll(true)
    setRegenAllProgress(0)
    setActionError(null)
    for (let i = 0; i < LLD_SECTION_META.length; i++) {
      const { key } = LLD_SECTION_META[i]
      setRegenerating(key)
      setRegenAllProgress(i + 1)
      try {
        const updated = await regenerateLLDSection(runId, key, null)
        onSectionRegenerated(updated)
      } catch (err) {
        setActionError(`Failed on ${key}: ${err.message}`)
        break
      } finally {
        setRegenerating(null)
      }
    }
    setRegeneratingAll(false)
    setRegenAllProgress(0)
  }

  const handleCopy = async () => {
    if (!current) return
    try {
      await navigator.clipboard.writeText(current.content_markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleToggleHistory = async () => {
    if (showHistory) { setShowHistory(false); return }
    setVersionsLoading(true)
    setShowHistory(true)
    try {
      setVersions(await fetchLLDSectionVersions(runId, activeSection))
    } catch { setVersions([]) }
    finally { setVersionsLoading(false) }
  }

  const handleRestore = async (versionId) => {
    setRestoring(versionId)
    setActionError(null)
    try {
      const updated = await restoreLLDSectionVersion(runId, activeSection, versionId)
      onSectionRegenerated(updated)
      setVersions(await fetchLLDSectionVersions(runId, activeSection))
    } catch (err) {
      setActionError(`Restore failed: ${err.message}`)
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* Regenerate All bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {regeneratingAll
            ? `Regenerating section ${regenAllProgress} of ${LLD_SECTION_META.length}...`
            : `${artifacts.length} of ${LLD_SECTION_META.length} sections generated`}
        </p>
        <button
          onClick={handleRegenerateAll}
          disabled={!!regenerating || regeneratingAll || editing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
        >
          {regeneratingAll
            ? <><Loader2 size={11} className="animate-spin" /> Regenerating All...</>
            : <><RefreshCw size={11} /> Regenerate All</>}
        </button>
      </div>

      <div className="flex gap-5 min-h-0">
        {/* Left nav */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sections</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">
                {artifacts.length}/{LLD_SECTION_META.length}
              </span>
            </div>
            {LLD_SECTION_META.map((section) => {
              const Icon    = section.icon
              const active  = activeSection === section.key
              const done    = !!artifactMap[section.key]
              const isRegen = regenerating === section.key
              return (
                <button
                  key={section.key}
                  onClick={() => done && switchSection(section.key)}
                  disabled={!done || editing || regeneratingAll}
                  title={section.description}
                  className={`w-full flex items-center gap-2.5 px-4 py-3 text-xs text-left border-b border-gray-100 last:border-0 transition-colors ${
                    active
                      ? 'bg-violet-50 text-violet-700 font-semibold'
                      : done && !editing
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Icon size={13} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{section.label}</span>
                  {isRegen
                    ? <Loader2 size={12} className="animate-spin text-violet-400 flex-shrink-0" />
                    : done
                    ? <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                    : null}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {current ? (
            <>
              {/* Section header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  {(() => { const Icon = meta?.icon || Wand2; return <Icon size={15} className="text-violet-500 flex-shrink-0" /> })()}
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900">{meta?.label}</h2>
                    {(() => {
                      const ts = formatTimestamp(current?.created_at)
                      return ts ? (
                        <p className="text-[10px] text-gray-400 mt-0.5" title={ts.abs}>Generated {ts.relative}</p>
                      ) : null
                    })()}
                  </div>
                  {editing && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-semibold tracking-wide flex-shrink-0">
                      <Pencil size={9} /> EDITING
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <button onClick={handleCancelEdit} disabled={saving}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-all">
                        <X size={12} /> Discard
                      </button>
                      <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-sm">
                        {saving ? <><Loader2 size={11} className="animate-spin" /> Saving...</> : <><Save size={11} /> Save changes</>}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleCopy} disabled={!!regenerating}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all shadow-sm">
                        {copied ? <CheckCircle2 size={11} className="text-green-500" /> : <Layers size={11} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <button onClick={handleToggleHistory} disabled={!!regenerating || regeneratingAll}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all shadow-sm ${
                          showHistory ? 'bg-amber-50 border-amber-300 text-amber-700' : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
                        }`}>
                        <History size={11} /> History
                      </button>
                      <button onClick={handleEdit} disabled={!!regenerating || regeneratingAll}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all shadow-sm">
                        <Pencil size={11} /> Edit
                      </button>
                      {showRegenInput ? (
                        <button onClick={() => { setShowRegenInput(false); setRegenInstruction('') }} disabled={!!regenerating}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all">
                          <X size={11} /> Cancel
                        </button>
                      ) : (
                        <button onClick={() => setShowRegenInput(true)} disabled={!!regenerating}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-40 transition-all">
                          <RefreshCw size={11} /> Regenerate
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Section description */}
              {meta?.description && !editing && (
                <div className="flex items-start gap-2 px-5 py-2.5 bg-violet-50/40 border-b border-violet-100">
                  <Info size={11} className="text-violet-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-violet-600 leading-relaxed">{meta.description}</p>
                </div>
              )}

              {actionError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border-b border-red-200 px-5 py-2.5 text-xs">
                  <AlertCircle size={12} className="flex-shrink-0" /> {actionError}
                </div>
              )}

              {/* Regenerate input */}
              {showRegenInput && !editing && (
                <div className="border-b border-violet-100 bg-violet-50/60 px-5 py-3">
                  <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-1.5">
                    Regenerate Instruction <span className="font-normal normal-case text-violet-400">(optional)</span>
                  </p>
                  <div className="flex gap-2 items-start">
                    <textarea
                      value={regenInstruction}
                      onChange={(e) => setRegenInstruction(e.target.value)}
                      placeholder={`e.g. "Add pagination to list endpoints" or "Include error response schemas"`}
                      rows={2}
                      className="flex-1 text-xs text-gray-700 border border-violet-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none placeholder-gray-400"
                    />
                    <button onClick={handleRegenerate} disabled={!!regenerating}
                      className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-all flex-shrink-0">
                      {regenerating === activeSection
                        ? <><Loader2 size={11} className="animate-spin" /> Regenerating...</>
                        : <><RefreshCw size={11} /> Regenerate</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Version history */}
              {showHistory && !editing && (
                <div className="border-b border-amber-100 bg-amber-50/50 px-5 py-3 max-h-64 overflow-y-auto">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2">Version History</p>
                  {versionsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                      <Loader2 size={12} className="animate-spin" /> Loading versions...
                    </div>
                  ) : versions.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1">No previous versions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {versions.map((v) => {
                        const ts = formatTimestamp(v.saved_at)
                        return (
                          <div key={v.id} className="flex items-center justify-between gap-3 bg-white border border-amber-200 rounded-lg px-3 py-2">
                            <div className="min-w-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium mr-2 ${
                                v.version_note === 'regenerated'     ? 'bg-violet-100 text-violet-600' :
                                v.version_note === 'manually edited' ? 'bg-emerald-100 text-emerald-600' :
                                'bg-gray-100 text-gray-500'
                              }`}>{v.version_note || 'saved'}</span>
                              <span className="text-[11px] text-gray-500" title={ts?.abs}>{ts?.relative || v.saved_at}</span>
                            </div>
                            <button onClick={() => handleRestore(v.id)} disabled={!!restoring}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 disabled:opacity-40 flex-shrink-0 transition-all">
                              {restoring === v.id
                                ? <><Loader2 size={10} className="animate-spin" /> Restoring...</>
                                : <><RotateCcw size={10} /> Restore</>}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Content / Editor */}
              {editing ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-700">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                      <span className="text-[10px] text-gray-400 ml-3 font-mono tracking-wider">markdown editor</span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {editContent.split('\n').length} lines · {editContent.length} chars
                    </span>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 w-full min-h-[58vh] text-[12px] font-mono text-gray-100 bg-gray-900 px-5 py-4 focus:outline-none resize-none leading-[1.8] tracking-wide"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="p-5 overflow-y-auto">
                  <MarkdownContent content={current.content_markdown} />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <p className="text-sm">Select a section from the left.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── LLD Tab ───────────────────────────────────────────────────────────────────

function LLDTab({ project }) {
  const [run,             setRun]             = useState(null)
  const [artifacts,       setArtifacts]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [starting,        setStarting]        = useState(false)
  const [error,           setError]           = useState(null)
  const [pollingId,       setPollingId]       = useState(null)
  const [genRuns,         setGenRuns]         = useState([])
  const [designRuns,      setDesignRuns]      = useState([])
  const [selectedGenRun,  setSelectedGenRun]  = useState('')
  const [selectedHldRun,  setSelectedHldRun]  = useState('')
  const [exportingPdf,    setExportingPdf]    = useState(false)

  useEffect(() => {
    Promise.all([
      fetchProjectLatestLLD(project.id).catch(() => null),
      fetchProjectGenerations(project.id).catch(() => []),
      fetchProjectDesignHistory(project.id).catch(() => []),
    ]).then(([latestLLD, allGenRuns, allDesignRuns]) => {
      if (latestLLD) {
        setRun(latestLLD)
        if (latestLLD.status === 'completed') loadArtifacts(latestLLD.id)
        if (!['completed', 'failed'].includes(latestLLD.status)) setPollingId(latestLLD.id)
        if (latestLLD.generation_run_id) setSelectedGenRun(String(latestLLD.generation_run_id))
        if (latestLLD.design_run_id)     setSelectedHldRun(String(latestLLD.design_run_id))
      }
      const completedGen    = (allGenRuns    || []).filter((r) => r.status === 'completed')
      const completedDesign = (allDesignRuns || []).filter((r) => r.status === 'completed')
      setGenRuns(completedGen)
      setDesignRuns(completedDesign)
      if (!latestLLD?.generation_run_id && completedGen.length > 0)
        setSelectedGenRun(String(completedGen[0].id))
      if (!latestLLD?.design_run_id && completedDesign.length > 0)
        setSelectedHldRun(String(completedDesign[0].id))
    }).finally(() => setLoading(false))
  }, [project.id])

  const loadArtifacts = async (runId) => {
    try { setArtifacts(await fetchLLDArtifacts(runId)) } catch {}
  }

  useLLDPolling({
    runId:    pollingId,
    enabled:  !!pollingId,
    onUpdate: (r) => setRun(r),
    onDone:   (r) => {
      setRun(r)
      setPollingId(null)
      if (r.status === 'completed') loadArtifacts(r.id)
    },
  })

  const handleGenerate = async () => {
    setStarting(true)
    setError(null)
    try {
      const kickoff = await startLLDGeneration(project.id, {
        generationRunId: selectedGenRun ? Number(selectedGenRun) : undefined,
        designRunId:     selectedHldRun ? Number(selectedHldRun) : undefined,
      })
      setRun({ id: kickoff.lld_run_id, status: 'pending', progress_message: null, artifacts: [] })
      setArtifacts([])
      setPollingId(kickoff.lld_run_id)
    } catch (err) {
      setError(`Failed to start LLD generation — ${err.message}`)
    } finally {
      setStarting(false)
    }
  }

  const handleExportPdf = (currentArtifacts) => {
    setExportingPdf(true)
    const win = window.open('', '_blank')
    const sections = LLD_SECTION_META
      .map((m) => currentArtifacts.find((a) => a.section_type === m.key))
      .filter(Boolean)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>LLD — ${project.name}</title>
      <style>
        body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;color:#1a1a2e;line-height:1.6}
        h1{font-size:22px;border-bottom:2px solid #7c3aed;padding-bottom:8px;margin-bottom:4px}
        .meta{font-size:12px;color:#6b7280;margin-bottom:32px}
        h2{font-size:16px;color:#7c3aed;margin-top:36px;border-bottom:1px solid #ede9fe;padding-bottom:4px}
        h3{font-size:13px;margin-top:20px}
        table{border-collapse:collapse;width:100%;font-size:12px;margin:12px 0}
        th{background:#f5f3ff;text-align:left;padding:6px 10px;border:1px solid #ddd6fe}
        td{padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top}
        pre{background:#1e293b;color:#86efac;padding:14px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap}
        code{background:#f5f3ff;padding:1px 4px;border-radius:3px;font-size:11px}
        @media print{body{margin:20px}pre{white-space:pre-wrap}}
      </style></head><body>
      <h1>Low-Level Design — ${project.name}</h1>
      <p class="meta">${project.client_name ? `Client: ${project.client_name} &nbsp;|&nbsp; ` : ''}Generated: ${new Date().toLocaleDateString()}</p>
      ${sections.map((a) => {
        const m = LLD_SECTION_META.find((x) => x.key === a.section_type)
        const md = a.content_markdown
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/```[\s\S]*?```/g, (blk) => `<pre>${blk.slice(3,-3).trim()}</pre>`)
          .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
          .replace(/^## (.+)$/gm,'<h2>$1</h2>')
          .replace(/^### (.+)$/gm,'<h3>$1</h3>')
          .replace(/^\|(.+)$/gm, (line) => {
            if (/^[\|\-\:\s]+$/.test(line)) return ''
            const cells = line.split('|').slice(1,-1).map(c=>`<td>${c.trim()}</td>`).join('')
            return `<tr>${cells}</tr>`
          })
          .replace(/(<tr>[\s\S]*?<\/tr>)/g, (t,_,offset,str) => {
            const prev = str.slice(0,offset).trim()
            return prev.endsWith('</tr>') || prev.endsWith('</table>') ? t : `<table>${t}`
          })
          .replace(/(<\/tr>)(?!\s*<tr>)(?!\s*<\/table>)/g,'$1</table>')
          .replace(/^[-*•] (.+)$/gm,'<li>$1</li>')
          .replace(/(<li>.*<\/li>\n?)+/g,(m)=>`<ul>${m}</ul>`)
          .replace(/\n\n/g,'<br>')
        return `<h2>${m?.label || a.section_type}</h2>${md}`
      }).join('')}
      <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`
    win.document.write(html)
    win.document.close()
    setExportingPdf(false)
  }

  const handleDelete = async () => {
    if (!run || !window.confirm('Delete this LLD run?')) return
    try {
      await deleteLLDRun(run.id)
      setRun(null)
      setArtifacts([])
      setPollingId(null)
    } catch { setError('Failed to delete.') }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Checking for existing LLD...</span>
      </div>
    )
  }

  const isRunning  = run && ['pending', 'generating'].includes(run.status)
  const isComplete = run?.status === 'completed'
  const isFailed   = run?.status === 'failed'

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">LLD Generation</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Generate 6 detailed design sections grounded in your HLD, requirements, and SOW.
          </p>

          <div className="mt-3 flex flex-col gap-2.5">
            {/* HLD Run selector */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                HLD Context <span className="text-violet-500 font-semibold">(recommended)</span>
              </label>
              {designRuns.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
                  No completed HLD runs — generate an HLD first for best results.
                </p>
              ) : (
                <select
                  value={selectedHldRun}
                  onChange={(e) => setSelectedHldRun(e.target.value)}
                  disabled={isRunning || starting}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50 min-w-[280px]"
                >
                  <option value="">None (no HLD context)</option>
                  {designRuns.map((r) => (
                    <option key={r.id} value={r.id}>HLD Run #{r.id}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Requirements Run selector */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                Requirements Context
              </label>
              {genRuns.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
                  No completed requirements runs — LLD will use SOW only.
                </p>
              ) : (
                <select
                  value={selectedGenRun}
                  onChange={(e) => setSelectedGenRun(e.target.value)}
                  disabled={isRunning || starting}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50 min-w-[280px]"
                >
                  <option value="">None (SOW only)</option>
                  {genRuns.map((r) => (
                    <option key={r.id} value={r.id}>
                      Run #{r.id} — {r.methodology} · {r.service_line_codes?.join(', ')}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {isComplete && (
            <button
              onClick={() => handleExportPdf(artifacts)}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 hover:border-violet-300 disabled:opacity-50 transition-all shadow-sm"
            >
              {exportingPdf
                ? <><Loader2 size={12} className="animate-spin" /> Preparing...</>
                : <><FileDown size={12} /> Export PDF</>}
            </button>
          )}
          {run && (
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button onClick={handleGenerate} disabled={isRunning || starting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {isRunning || starting
              ? <><Loader2 size={12} className="animate-spin" /> Generating...</>
              : isComplete
              ? <><RefreshCw size={12} /> Regenerate LLD</>
              : <><Wand2 size={12} /> Generate LLD</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-xs">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Context strip */}
      {run && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 mb-4 flex-wrap">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Generated with</span>
          <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${
            run.design_run_id ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {run.design_run_id ? `✓ HLD Run #${run.design_run_id}` : '⚠ No HLD linked'}
          </span>
          <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${
            run.generation_run_id ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {run.generation_run_id ? `✓ Requirements Run #${run.generation_run_id}` : '⚠ No requirements run'}
          </span>
          <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${
            run.sow_id ? 'bg-green-50 text-green-600 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {run.sow_id ? '✓ SOW linked' : '⚠ No SOW'}
          </span>
        </div>
      )}

      {/* Progress */}
      {isRunning && (() => {
        const match = run?.progress_message?.match(/\((\d+)\/(\d+)\)/)
        const done  = match ? parseInt(match[1]) : 0
        const total = match ? parseInt(match[2]) : 6
        const pct   = done > 0 ? Math.round((done / total) * 100) : 5
        const sectionLabel = LLD_SECTION_META[done > 0 ? done - 1 : 0]?.label || ''
        return (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 mb-5">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 size={16} className="animate-spin text-violet-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-violet-700">
                  {done > 0 ? `Generating ${sectionLabel}...` : 'Starting LLD generation...'}
                </p>
                {done > 0 && (
                  <p className="text-[11px] text-violet-400 mt-0.5">
                    Section {done} of {total} — {pct}% complete
                  </p>
                )}
              </div>
            </div>
            <div className="w-full bg-violet-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-violet-600 h-2 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-1.5">
                {LLD_SECTION_META.map((s, i) => (
                  <div
                    key={s.key}
                    title={s.label}
                    className={`h-1.5 w-6 rounded-full transition-all duration-500 ${
                      i < done ? 'bg-violet-500' : i === done ? 'bg-violet-300 animate-pulse' : 'bg-violet-100'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[10px] text-violet-400">{done}/{total} sections</p>
            </div>
          </div>
        )
      })()}

      {isFailed && (
        <InfoBanner icon={AlertCircle} color="bg-red-50 border-red-200 text-red-700">
          LLD generation failed. {run.error_log || 'Unknown error.'} Click "Generate LLD" to retry.
        </InfoBanner>
      )}

      {/* No run yet */}
      {!run && !isRunning && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <Wand2 size={22} className="text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">No LLD generated yet</p>
          <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
            Click "Generate LLD" to produce 6 detailed design documents grounded in your HLD and requirements.
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {LLD_SECTION_META.map((s) => (
              <span key={s.key} className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {isComplete && artifacts.length > 0 && (
        <LLDViewer
          artifacts={artifacts}
          runId={run.id}
          onSectionRegenerated={(updated) =>
            setArtifacts((prev) => prev.map((a) => a.section_type === updated.section_type ? updated : a))
          }
        />
      )}
    </div>
  )
}

// ── Standards + Combinations tabs (reused pattern) ───────────────────────────

function StandardsTab({ project, standards }) {
  const serviceLines = project.service_line?.split(',').map((s) => s.trim()) || []
  const grouped = SERVICE_LINE_GROUPS
    .map((g) => ({ ...g, standards: standards.filter((s) => s.group === g.label) }))
    .filter((g) => g.standards.length > 0)

  if (standards.length === 0) {
    return (
      <InfoBanner icon={Info} color="bg-amber-50 border-amber-200 text-amber-700">
        No service lines linked to this project.
      </InfoBanner>
    )
  }
  return (
    <div>
      <InfoBanner icon={Info} color="bg-violet-50 border-violet-200 text-violet-700">
        Showing design standards for <strong>{serviceLines.length} service line{serviceLines.length > 1 ? 's' : ''}</strong> used in this project.
      </InfoBanner>
      <div className="space-y-8">
        {grouped.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${group.dot}`} />
              <h3 className={`text-xs font-bold tracking-wider uppercase ${group.color}`}>{group.label}</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {group.standards.map((s) => <ServiceLineStandardCard key={s.code} standard={s} highlighted />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CombinationsTab({ project, combos }) {
  const serviceLines = project.service_line?.split(',').map((s) => s.trim()) || []
  if (combos.length === 0) {
    return (
      <InfoBanner icon={Info} color="bg-amber-50 border-amber-200 text-amber-700">
        No platform combinations match this project's service lines.
      </InfoBanner>
    )
  }
  return (
    <div>
      <InfoBanner icon={Info} color="bg-violet-50 border-violet-200 text-violet-700">
        Found <strong>{combos.length} platform combination{combos.length > 1 ? 's' : ''}</strong> matching this project's service lines.
      </InfoBanner>
      <PlatformCombinationTable combinations={combos} highlightedCodes={serviceLines} />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'lld',          label: 'LLD Generation',         icon: Wand2      },
  { id: 'standards',    label: 'Service Line Standards', icon: Layers     },
  { id: 'combinations', label: 'Platform Combinations',  icon: LayoutGrid },
]

export default function LLDProjectDetail() {
  const { projectId } = useParams()
  const navigate      = useNavigate()
  const [project,   setProject]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [activeTab, setActiveTab] = useState('lld')

  useEffect(() => {
    fetchProject(projectId)
      .then(setProject)
      .catch(() => setError('Failed to load project.'))
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={22} className="animate-spin mr-2" />
        <span className="text-sm">Loading project...</span>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} />
          <span className="text-sm">{error || 'Project not found.'}</span>
        </div>
      </div>
    )
  }

  const serviceLines      = project.service_line?.split(',').map((s) => s.trim()).filter(Boolean) || []
  const relevantStandards = filterByProject(project.service_line)
  const matchingCombos    = findMatchingCombos(project.service_line)

  return (
    <div className="p-8">
      <button onClick={() => navigate('/lld-studio')}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-5">
        <ArrowLeft size={14} /> Back to LLD Studio
      </button>

      {/* Project header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <GitBranch size={22} className="text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h1 className="text-lg font-bold text-gray-900">{project.name}</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-violet-50 text-violet-600 border-violet-200">LLD</span>
            </div>
            {project.client_name && <p className="text-sm text-gray-500 mb-3">{project.client_name}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
              {project.engagement_model && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Engagement</p>
                  <p className="font-medium text-gray-700">{project.engagement_model}</p>
                </div>
              )}
              {project.methodology && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Methodology</p>
                  <p className="font-medium text-gray-700">{project.methodology}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Standards</p>
                <p className="font-medium text-gray-700">{relevantStandards.length} matched</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Combos</p>
                <p className="font-medium text-gray-700">{matchingCombos.length} matched</p>
              </div>
            </div>
            {serviceLines.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Service Lines</p>
                <div className="flex flex-wrap gap-1.5">
                  {serviceLines.map((sl) => <ServiceLineTag key={sl} code={sl} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        {TABS.map((tab) => {
          const Icon   = tab.icon
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all ${
                active
                  ? 'border-violet-600 text-violet-700 bg-violet-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <Icon size={13} />
              {tab.label}
              {tab.id === 'standards' && relevantStandards.length > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-violet-200 text-violet-700' : 'bg-gray-200 text-gray-500'}`}>
                  {relevantStandards.length}
                </span>
              )}
              {tab.id === 'combinations' && matchingCombos.length > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-violet-200 text-violet-700' : 'bg-gray-200 text-gray-500'}`}>
                  {matchingCombos.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'lld'          && <LLDTab          project={project} />}
      {activeTab === 'standards'    && <StandardsTab    project={project} standards={relevantStandards} />}
      {activeTab === 'combinations' && <CombinationsTab project={project} combos={matchingCombos} />}
    </div>
  )
}
