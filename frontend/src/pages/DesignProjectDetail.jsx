import { useState, useEffect, useCallback, useRef } from 'react'
import mermaid from 'mermaid'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Compass, Loader2, AlertCircle,
  Layers, LayoutGrid, Wand2, Info, Wand,
  FolderTree, Cpu, Puzzle, Zap, ShieldCheck,
  RefreshCw, Trash2, CheckCircle2, Clock, Network, Database, Lock, FileDown, Pencil, X, Save, History, RotateCcw, GitBranch,
  Download, Table2, Share2,
} from 'lucide-react'
import { fetchProject } from '../api/projectsApi'
import { fetchProjectGenerations } from '../api/generationApi'
import {
  startHLDGeneration,
  fetchProjectLatestDesign,
  fetchDesignArtifacts,
  deleteDesignRun,
  regenerateSection,
  updateDesignArtifact,
  exportDesignRunDocx,
  fetchSectionVersions,
  restoreSectionVersion,
} from '../api/designApi'
import { useDesignPolling } from '../hooks/useDesignPolling'
import ServiceLineStandardCard from '../components/design/ServiceLineStandardCard'
import PlatformCombinationTable from '../components/design/PlatformCombinationTable'
import { filterByProject, SERVICE_LINE_GROUPS } from '../data/serviceLineStandards'
import { findMatchingCombos } from '../data/platformCombinations'

// ── Helpers ───────────────────────────────────────────────────────────────────

const HLD_SECTION_META = [
  { key: 'folder_structure',      label: 'Folder Structure',      icon: FolderTree,  description: 'Directory layout for each service/repo — how code is organized by layer and responsibility.' },
  { key: 'component_structure',   label: 'Component Structure',   icon: Cpu,         description: 'Major system components, their responsibilities, and how they communicate with each other.' },
  { key: 'design_patterns',       label: 'Design Patterns',       icon: Puzzle,      description: 'Software patterns (e.g. Service Layer, Trigger Framework) applied to solve recurring design problems.' },
  { key: 'technology',            label: 'Technology Stack',      icon: Zap,         description: 'Technologies, frameworks, and platforms chosen for each layer — with rationale for each decision.' },
  { key: 'error_handling',        label: 'Error Handling',        icon: ShieldCheck, description: 'How errors are caught, retried, and surfaced — layer-by-layer strategy and logging standards.' },
  { key: 'api_design',            label: 'API Design',            icon: Network,     description: 'Endpoint contracts, request/response formats, authentication strategy, and rate limiting.' },
  { key: 'database_design',       label: 'Database Design',       icon: Database,    description: 'Core entities, relationships, indexing strategy, and data retention policy.' },
  { key: 'er_diagram',            label: 'ER Diagram',            icon: Table2,      description: 'Mermaid erDiagram showing all database entities, attributes, primary/foreign keys, and relationships.' },
  { key: 'security_architecture', label: 'Security Architecture', icon: Lock,        description: 'Auth model, role definitions, encryption, secrets management, and audit logging.' },
  { key: 'page_flow',             label: 'Page Flow & Integration', icon: Share2,    description: 'Mermaid flowchart showing all pages/screens, user navigation paths, and system integration points.' },
  { key: 'system_architecture',   label: 'Architecture Diagram',  icon: GitBranch,   description: 'Visual Mermaid diagram showing all system components, data flows, and external integrations.' },
]

function formatTimestamp(isoString) {
  if (!isoString) return null
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = now - d
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
    <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
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

// ── Standards Tab ─────────────────────────────────────────────────────────────
function StandardsTab({ project, standards }) {
  const serviceLines = project.service_line?.split(',').map((s) => s.trim()) || []
  const grouped = SERVICE_LINE_GROUPS.map((g) => ({
    ...g,
    standards: standards.filter((s) => s.group === g.label),
  })).filter((g) => g.standards.length > 0)

  if (standards.length === 0) {
    return (
      <InfoBanner icon={Info} color="bg-amber-50 border-amber-200 text-amber-700">
        No service lines linked to this project. Add service lines when creating/editing the project to
        see relevant design standards here.
      </InfoBanner>
    )
  }

  return (
    <div>
      <InfoBanner icon={Info} color="bg-indigo-50 border-indigo-200 text-indigo-700">
        Showing design standards for <strong>{serviceLines.length} service line{serviceLines.length > 1 ? 's' : ''}</strong> used
        in this project. Expand any card to view design patterns, folder structure, and NFR baselines.
      </InfoBanner>
      <div className="space-y-8">
        {grouped.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${group.dot}`} />
              <h3 className={`text-xs font-bold tracking-wider uppercase ${group.color}`}>{group.label}</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {group.standards.map((s) => (
                <ServiceLineStandardCard key={s.code} standard={s} highlighted />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Combinations Tab ──────────────────────────────────────────────────────────
function CombinationsTab({ project, combos }) {
  const serviceLines = project.service_line?.split(',').map((s) => s.trim()) || []
  if (combos.length === 0) {
    return (
      <InfoBanner icon={Info} color="bg-amber-50 border-amber-200 text-amber-700">
        No platform combinations match this project's service lines. Add more service lines to find
        relevant pre-configured combinations.
      </InfoBanner>
    )
  }
  return (
    <div>
      <InfoBanner icon={Info} color="bg-indigo-50 border-indigo-200 text-indigo-700">
        Found <strong>{combos.length} platform combination{combos.length > 1 ? 's' : ''}</strong> matching
        this project's service lines. Click any row for integration patterns and architecture details.
      </InfoBanner>
      <PlatformCombinationTable combinations={combos} highlightedCodes={serviceLines} />
    </div>
  )
}

// ── Inline renderer (bold, inline code) ──────────────────────────────────────
function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
        if (p.startsWith('`') && p.endsWith('`'))
          return <code key={i} className="bg-gray-100 text-indigo-600 px-1 py-0.5 rounded text-[11px] font-mono">{p.slice(1, -1)}</code>
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

// ── Table renderer ────────────────────────────────────────────────────────────
function MdTable({ lines }) {
  const isSep = (l) => /^[\|\-\:\s]+$/.test(l)
  const data = lines.filter((l) => !isSep(l))
  if (data.length === 0) return null
  const parseRow = (l) => l.split('|').slice(1, -1).map((c) => c.trim())
  const [header, ...rows] = data
  const headers = parseRow(header)
  return (
    <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-indigo-50 border-b border-indigo-200">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2.5 text-indigo-700 font-semibold whitespace-nowrap">
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

// ── Markdown block parser + renderer ─────────────────────────────────────────
function MarkdownContent({ content }) {
  const blocks = []
  const lines = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // fenced code block
    if (line.startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      i++
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      continue
    }

    // table block
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

        const { content: ln } = block

        if (ln.startsWith('#### ')) return (
          <h4 key={idx} className="text-xs font-bold text-gray-800 mt-5 mb-1.5">
            <Inline text={ln.slice(5)} />
          </h4>
        )
        if (ln.startsWith('### ')) return (
          <h3 key={idx} className="text-sm font-bold text-gray-900 mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-indigo-400 rounded-full flex-shrink-0" />
            <Inline text={ln.slice(4)} />
          </h3>
        )
        if (ln.startsWith('## ')) return (
          <h2 key={idx} className="text-base font-bold text-gray-900 mt-7 mb-3 pb-2 border-b-2 border-indigo-100">
            <Inline text={ln.slice(3)} />
          </h2>
        )
        if (ln.startsWith('# ')) return (
          <h1 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-3">
            <Inline text={ln.slice(2)} />
          </h1>
        )

        if (ln.startsWith('- ') || ln.startsWith('* ') || ln.startsWith('• ')) {
          const text = ln.replace(/^[-*•] /, '')
          return (
            <div key={idx} className="flex gap-2 text-xs text-gray-700 mb-1.5 leading-relaxed">
              <span className="text-indigo-400 flex-shrink-0 mt-0.5 font-bold">▸</span>
              <span><Inline text={text} /></span>
            </div>
          )
        }

        if (ln.trim() === '') return <div key={idx} className="h-3" />

        return (
          <p key={idx} className="text-xs text-gray-700 leading-relaxed mb-1">
            <Inline text={ln} />
          </p>
        )
      })}
    </div>
  )
}

// ── Mermaid Diagram Renderer ──────────────────────────────────────────────────

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' })

const MERMAID_CLASS_NAMES = ['userNode', 'internalNode', 'externalNode', 'dbNode']
const MERMAID_CLASS_RE = new RegExp(`(\\w+)\\[(${MERMAID_CLASS_NAMES.join('|')}):([^\\]]+)\\]`, 'g')
const MERMAID_CLASS_ROUND_RE = new RegExp(`(\\w+)\\(\\[(${MERMAID_CLASS_NAMES.join('|')}):([^\\]]+)\\]\\)`, 'g')

function sanitizeMermaid(code) {
  const firstLine = code.trim().split('\n')[0].trim().toLowerCase()
  const isFlowchart = firstLine.startsWith('flowchart') || firstLine.startsWith('graph')

  // Universal fixes
  let result = code
    .replace(/,rx:\d+/g, '')   // classDef rx:N is SVG attr not CSS — always strip
    .replace(/—/g, '-')         // em dash trips the lexer in any diagram type

  // Flowchart-only fixes (would corrupt erDiagram syntax)
  if (isFlowchart) {
    result = result
      .replace(MERMAID_CLASS_RE, '$1[$3]')
      .replace(MERMAID_CLASS_ROUND_RE, '$1([$3])')
      .replace(/\|>/g, '|')
      .replace(/(\w+)\[([^\]]+)\]/g, (_, id, label) =>
        `${id}[${label.replace(/\(([^)]*)\)/g, '$1').replace(/\//g, '-').replace(/&/g, 'and')}]`
      )
  }

  return result
}

function MermaidDiagram({ code, filename = 'diagram' }) {
  const [svg,       setSvg]       = useState('')
  const [error,     setError]     = useState(null)
  const [cleanCode, setCleanCode] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    setSvg('')
    setError(null)
    const id    = `mermaid-${Math.random().toString(36).slice(2)}`
    const clean = sanitizeMermaid(code.trim())
    setCleanCode(clean)
    mermaid.render(id, clean)
      .then(({ svg: rendered }) => {
        // Mermaid v11 resolves even on syntax errors — detect error SVG
        if (rendered.toLowerCase().includes('syntax error') || rendered.toLowerCase().includes('parse error')) {
          setError(true)
        } else {
          setSvg(rendered)
        }
      })
      .catch(() => setError(true))
  }, [code])

  const handleDownloadPng = () => {
    const svgEl = containerRef.current?.querySelector('svg')
    if (!svgEl) return

    // Clone so we don't mutate the displayed SVG
    const clone = svgEl.cloneNode(true)

    // Mermaid SVGs often have only viewBox — set explicit px dimensions
    // so the browser knows the raster size when loading as an Image
    const rect = svgEl.getBoundingClientRect()
    const w = Math.max(rect.width || 0, 800)
    const h = Math.max(rect.height || 0, 400)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width',  String(w))
    clone.setAttribute('height', String(h))

    const svgString = new XMLSerializer().serializeToString(clone)

    // base64 data URL is more reliable than blob URL for SVG→Canvas in all browsers
    const encoded = btoa(unescape(encodeURIComponent(svgString)))
    const dataUrl = `data:image/svg+xml;base64,${encoded}`

    const scale  = 2
    const canvas = document.createElement('canvas')
    canvas.width  = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.onload = () => {
      ctx.scale(scale, scale)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      try {
        const a = document.createElement('a')
        a.download = `${filename}.png`
        a.href = canvas.toDataURL('image/png')
        a.click()
      } catch {
        // Canvas tainted fallback — download SVG instead
        const a = document.createElement('a')
        a.download = `${filename}.svg`
        a.href = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))
        a.click()
      }
    }
    img.onerror = () => {
      // Last resort: direct SVG download
      const a = document.createElement('a')
      a.download = `${filename}.svg`
      a.href = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))
      a.click()
    }
    img.src = dataUrl
  }

  if (error) return (
    <div>
      <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
        <AlertCircle size={12} /> Diagram syntax error — showing raw code. Regenerate this section to fix.
      </p>
      <pre className="bg-gray-900 text-emerald-400 rounded-xl p-4 text-[11px] font-mono overflow-x-auto my-2 leading-relaxed whitespace-pre">
        {cleanCode || code}
      </pre>
    </div>
  )

  if (!svg) return (
    <div className="flex items-center gap-2 text-gray-400 py-6 text-xs">
      <Loader2 size={14} className="animate-spin" /> Rendering diagram...
    </div>
  )

  return (
    <div className="my-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-gray-100 bg-gray-50">
        <button
          onClick={handleDownloadPng}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-gray-500 border border-gray-200 rounded-lg hover:bg-white hover:text-indigo-600 hover:border-indigo-200 transition-all"
        >
          <Download size={11} /> Download PNG
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} className="flex justify-center" />
      </div>
    </div>
  )
}

const SECTION_FILENAMES = {
  system_architecture: 'architecture-diagram',
  er_diagram:          'er-diagram',
  page_flow:           'page-flow-diagram',
}

function MarkdownContentWithMermaid({ content, sectionKey }) {
  const blocks = []
  const lines  = content.split('\n')
  let i = 0
  let diagramIndex = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim().toLowerCase()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      i++
      if (lang === 'mermaid') {
        const base = SECTION_FILENAMES[sectionKey] || 'diagram'
        const filename = diagramIndex === 0 ? base : `${base}-${diagramIndex + 1}`
        diagramIndex++
        blocks.push({ type: 'mermaid', content: codeLines.join('\n'), filename })
      } else {
        blocks.push({ type: 'code', content: codeLines.join('\n') })
      }
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
        if (block.type === 'mermaid') return <MermaidDiagram key={idx} code={block.content} filename={block.filename || 'diagram'} />
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
            <span className="w-1.5 h-4 bg-indigo-400 rounded-full flex-shrink-0" />
            <Inline text={ln.slice(4)} />
          </h3>
        )
        if (ln.startsWith('## ')) return <h2 key={idx} className="text-base font-bold text-gray-900 mt-7 mb-3 pb-2 border-b-2 border-indigo-100"><Inline text={ln.slice(3)} /></h2>
        if (ln.startsWith('# '))  return <h1 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-3"><Inline text={ln.slice(2)} /></h1>
        if (ln.startsWith('- ') || ln.startsWith('* ') || ln.startsWith('• ')) {
          const text = ln.replace(/^[-*•] /, '')
          return (
            <div key={idx} className="flex gap-2 text-xs text-gray-700 mb-1.5 leading-relaxed">
              <span className="text-indigo-400 flex-shrink-0 mt-0.5 font-bold">▸</span>
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

// ── HLD Section Viewer ────────────────────────────────────────────────────────
function HLDViewer({ artifacts, runId, onSectionRegenerated }) {
  const [activeSection,    setActiveSection]    = useState(HLD_SECTION_META[0].key)
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
  const meta        = HLD_SECTION_META.find((s) => s.key === activeSection)

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
      const updated = await updateDesignArtifact(runId, activeSection, editContent)
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
      const updated = await regenerateSection(runId, activeSection, regenInstruction || null)
      onSectionRegenerated(updated)
      setRegenInstruction('')
    } catch (err) {
      setActionError(`Regenerate failed: ${err.message}`)
    } finally {
      setRegenerating(null)
    }
  }

  const handleRegenerateAll = async () => {
    if (!window.confirm(`Regenerate all ${HLD_SECTION_META.length} sections? This will take a few minutes.`)) return
    setRegeneratingAll(true)
    setRegenAllProgress(0)
    setActionError(null)
    for (let i = 0; i < HLD_SECTION_META.length; i++) {
      const { key } = HLD_SECTION_META[i]
      setRegenerating(key)
      setRegenAllProgress(i + 1)
      try {
        const updated = await regenerateSection(runId, key, null)
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
      const v = await fetchSectionVersions(runId, activeSection)
      setVersions(v)
    } catch { setVersions([]) }
    finally { setVersionsLoading(false) }
  }

  const handleRestore = async (versionId) => {
    setRestoring(versionId)
    setActionError(null)
    try {
      const updated = await restoreSectionVersion(runId, activeSection, versionId)
      onSectionRegenerated(updated)
      // refresh versions list
      const v = await fetchSectionVersions(runId, activeSection)
      setVersions(v)
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
            ? `Regenerating section ${regenAllProgress} of ${HLD_SECTION_META.length}...`
            : `${artifacts.length} of ${HLD_SECTION_META.length} sections generated`}
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
          {HLD_SECTION_META.map((section) => {
            const Icon    = section.icon
            const active  = activeSection === section.key
            const done    = !!artifactMap[section.key]
            const isRegen = regenerating === section.key
            return (
              <button
                key={section.key}
                onClick={() => (!editing && !regeneratingAll) && switchSection(section.key)}
                disabled={editing || regeneratingAll}
                title={section.description}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-xs text-left border-b border-gray-100 last:border-0 transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : !editing && !regeneratingAll
                    ? 'text-gray-600 hover:bg-gray-50'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <Icon size={13} className="flex-shrink-0" />
                <span className="flex-1 truncate">{section.label}</span>
                {isRegen
                  ? <Loader2 size={12} className="animate-spin text-indigo-400 flex-shrink-0" />
                  : done
                  ? <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                  : <span className="text-[9px] text-amber-400 font-bold flex-shrink-0">NEW</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!current && activeSection ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 p-8 text-center">
            {(() => { const Icon = meta?.icon || Wand2; return <Icon size={28} className="text-indigo-200" /> })()}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">{meta?.label} not generated yet</p>
              <p className="text-xs text-gray-400 mb-3">This section was added after your HLD was generated.</p>
            </div>
            {actionError && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-sm">{actionError}</p>
            )}
            <button
              onClick={handleRegenerate}
              disabled={!!regenerating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              {regenerating === activeSection
                ? <><Loader2 size={13} className="animate-spin" /> Generating — this may take 30–60 seconds...</>
                : <><Wand2 size={13} /> Generate {meta?.label}</>}
            </button>
          </div>
        ) : current ? (
          <>
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
              <div className="flex items-center gap-2.5 min-w-0">
                {(() => { const Icon = meta?.icon || Wand2; return <Icon size={15} className="text-indigo-500 flex-shrink-0" /> })()}
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900">{meta?.label}</h2>
                  {(() => {
                    const ts = formatTimestamp(current?.created_at)
                    return ts ? (
                      <p className="text-[10px] text-gray-400 mt-0.5" title={ts.abs}>
                        Generated {ts.relative}
                      </p>
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
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 transition-all"
                    >
                      <X size={12} /> Discard
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-sm"
                    >
                      {saving
                        ? <><Loader2 size={11} className="animate-spin" /> Saving...</>
                        : <><Save size={11} /> Save changes</>}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCopy}
                      disabled={!!regenerating}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 transition-all shadow-sm"
                    >
                      {copied ? <CheckCircle2 size={11} className="text-green-500" /> : <Layers size={11} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleToggleHistory}
                      disabled={!!regenerating || regeneratingAll}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all shadow-sm ${
                        showHistory
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <History size={11} /> History
                    </button>
                    <button
                      onClick={handleEdit}
                      disabled={!!regenerating || regeneratingAll}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 transition-all shadow-sm"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    {showRegenInput ? (
                      <button
                        onClick={() => { setShowRegenInput(false); setRegenInstruction('') }}
                        disabled={!!regenerating}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
                      >
                        <X size={11} /> Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowRegenInput(true)}
                        disabled={!!regenerating}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-40 transition-all"
                      >
                        <RefreshCw size={11} /> Regenerate
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Section description banner */}
            {meta?.description && !editing && (
              <div className="flex items-start gap-2.5 px-5 py-2.5 bg-violet-50 border-b border-violet-100">
                <Info size={12} className="text-violet-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-violet-600 leading-relaxed">{meta.description}</p>
              </div>
            )}

            {actionError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border-b border-red-200 px-5 py-2.5 text-xs">
                <AlertCircle size={12} className="flex-shrink-0" /> {actionError}
              </div>
            )}

            {showRegenInput && !editing && (
              <div className="border-b border-indigo-100 bg-indigo-50/60 px-5 py-3">
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-1.5">
                  Regenerate Instruction <span className="font-normal normal-case text-indigo-400">(optional — leave blank to regenerate with same context)</span>
                </p>
                <div className="flex gap-2 items-start">
                  <textarea
                    value={regenInstruction}
                    onChange={(e) => setRegenInstruction(e.target.value)}
                    placeholder={`e.g. "Focus more on Azure AD integration and add MFA details" or "Include GDPR compliance considerations"`}
                    rows={2}
                    className="flex-1 text-xs text-gray-700 border border-indigo-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none placeholder-gray-400"
                  />
                  <button
                    onClick={handleRegenerate}
                    disabled={!!regenerating}
                    className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex-shrink-0"
                  >
                    {regenerating === activeSection
                      ? <><Loader2 size={11} className="animate-spin" /> Regenerating...</>
                      : <><RefreshCw size={11} /> Regenerate</>}
                  </button>
                </div>
              </div>
            )}

            {/* Version history panel */}
            {showHistory && !editing && (
              <div className="border-b border-amber-100 bg-amber-50/50 px-5 py-3 max-h-64 overflow-y-auto">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2">
                  Version History
                </p>
                {versionsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <Loader2 size={12} className="animate-spin" /> Loading versions...
                  </div>
                ) : versions.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1">No previous versions — versions are saved each time you regenerate or edit.</p>
                ) : (
                  <div className="space-y-2">
                    {versions.map((v) => {
                      const ts = formatTimestamp(v.saved_at)
                      return (
                        <div key={v.id} className="flex items-center justify-between gap-3 bg-white border border-amber-200 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium mr-2 ${
                              v.version_note === 'regenerated'     ? 'bg-indigo-100 text-indigo-600' :
                              v.version_note === 'manually edited' ? 'bg-emerald-100 text-emerald-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {v.version_note || 'saved'}
                            </span>
                            <span className="text-[11px] text-gray-500" title={ts?.abs}>{ts?.relative || v.saved_at}</span>
                          </div>
                          <button
                            onClick={() => handleRestore(v.id)}
                            disabled={!!restoring}
                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 disabled:opacity-40 flex-shrink-0 transition-all"
                          >
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

            {editing ? (
              <div className="flex flex-col h-full">
                {/* Editor toolbar */}
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
                {['system_architecture', 'er_diagram', 'page_flow'].includes(activeSection)
                  ? <MarkdownContentWithMermaid content={current.content_markdown} sectionKey={activeSection} />
                  : <MarkdownContent content={current.content_markdown} />
                }
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

// ── HLD Tab ───────────────────────────────────────────────────────────────────
function HLDTab({ project }) {
  const [run,           setRun]           = useState(null)
  const [artifacts,     setArtifacts]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [starting,      setStarting]      = useState(false)
  const [error,         setError]         = useState(null)
  const [pollingId,     setPollingId]     = useState(null)
  const [genRuns,       setGenRuns]       = useState([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [exporting,     setExporting]     = useState(false)
  const [exportingPdf,  setExportingPdf]  = useState(false)

  // Load existing design run + completed generation runs on mount
  useEffect(() => {
    Promise.all([
      fetchProjectLatestDesign(project.id).catch(() => null),
      fetchProjectGenerations(project.id).catch(() => []),
    ]).then(([latestDesign, allGenRuns]) => {
      if (latestDesign) {
        setRun(latestDesign)
        if (latestDesign.status === 'completed') loadArtifacts(latestDesign.id)
        if (!['completed', 'failed'].includes(latestDesign.status)) setPollingId(latestDesign.id)
        // pre-select the run that was used last time
        if (latestDesign.generation_run_id) setSelectedRunId(String(latestDesign.generation_run_id))
      }
      const completed = (allGenRuns || []).filter((r) => r.status === 'completed')
      setGenRuns(completed)
      // auto-select latest completed run if nothing pre-selected
      if (!latestDesign?.generation_run_id && completed.length > 0) {
        setSelectedRunId(String(completed[0].id))
      }
    }).finally(() => setLoading(false))
  }, [project.id])

  const loadArtifacts = async (runId) => {
    try {
      const arts = await fetchDesignArtifacts(runId)
      setArtifacts(arts)
    } catch {}
  }

  // Polling when run is in progress
  useDesignPolling({
    runId: pollingId,
    enabled: !!pollingId,
    onUpdate: (r) => setRun(r),
    onDone: (r) => {
      setRun(r)
      setPollingId(null)
      if (r.status === 'completed') loadArtifacts(r.id)
    },
  })

  const handleGenerate = async () => {
    setStarting(true)
    setError(null)
    try {
      const kickoff = await startHLDGeneration(project.id, {
        generationRunId: selectedRunId ? Number(selectedRunId) : undefined,
      })
      const newRun = { id: kickoff.design_run_id, status: 'pending', progress_message: null, artifacts: [] }
      setRun(newRun)
      setArtifacts([])
      setPollingId(kickoff.design_run_id)
    } catch (err) {
      setError(`Failed to start HLD generation — ${err.message}`)
    } finally {
      setStarting(false)
    }
  }

  const handleExport = async () => {
    if (!run) return
    setExporting(true)
    try {
      const safeName = project.name.replace(/[^\w\-]/g, '_')
      await exportDesignRunDocx(run.id, `HLD_${safeName}_run${run.id}.docx`)
    } catch (err) {
      setError(`Export failed — ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const handleExportPdf = () => {
    setExportingPdf(true)
    const win = window.open('', '_blank')
    const sections = HLD_SECTION_META
      .map((m) => artifacts.find((a) => a.section_type === m.key))
      .filter(Boolean)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>HLD — ${project.name}</title>
      <style>
        body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;color:#1a1a2e;line-height:1.6}
        h1{font-size:22px;border-bottom:2px solid #4f46e5;padding-bottom:8px;margin-bottom:4px}
        .meta{font-size:12px;color:#6b7280;margin-bottom:32px}
        h2{font-size:16px;color:#4f46e5;margin-top:36px;border-bottom:1px solid #e0e7ff;padding-bottom:4px}
        h3{font-size:13px;margin-top:20px}
        table{border-collapse:collapse;width:100%;font-size:12px;margin:12px 0}
        th{background:#eef2ff;text-align:left;padding:6px 10px;border:1px solid #c7d2fe}
        td{padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top}
        pre{background:#1e293b;color:#86efac;padding:14px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap}
        code{background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:11px}
        @media print{body{margin:20px}pre{white-space:pre-wrap}}
      </style></head><body>
      <h1>High-Level Design — ${project.name}</h1>
      <p class="meta">${project.client_name ? `Client: ${project.client_name} &nbsp;|&nbsp; ` : ''}Generated: ${new Date().toLocaleDateString()}</p>
      ${sections.map((a) => {
        const m = HLD_SECTION_META.find((x) => x.key === a.section_type)
        const md = a.content_markdown
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/```[\s\S]*?```/g, (m) => `<pre>${m.slice(3,-3).trim()}</pre>`)
          .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
          .replace(/^## (.+)$/gm,'<h2>$1</h2>')
          .replace(/^### (.+)$/gm,'<h3>$1</h3>')
          .replace(/^\|(.+)$/gm, (line) => {
            if (/^[\|\-\:\s]+$/.test(line)) return ''
            const cells = line.split('|').slice(1,-1).map(c=>`<td>${c.trim()}</td>`).join('')
            return `<tr>${cells}</tr>`
          })
          .replace(/(<tr>[\s\S]*?<\/tr>)/g, (t,_,offset,str) => {
            const prev = str.slice(0, offset).trim()
            return prev.endsWith('</tr>') || prev.endsWith('</table>') ? t : `<table>${t}`
          })
          .replace(/(<\/tr>)(?!\s*<tr>)(?!\s*<\/table>)/g, '$1</table>')
          .replace(/^[-*•] (.+)$/gm,'<li>$1</li>')
          .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
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
    if (!run || !window.confirm('Delete this HLD run?')) return
    try {
      await deleteDesignRun(run.id)
      setRun(null)
      setArtifacts([])
      setPollingId(null)
    } catch {
      setError('Failed to delete.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Checking for existing HLD...</span>
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
          <p className="text-sm font-semibold text-gray-900">HLD Generation</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Generate {HLD_SECTION_META.length} HLD sections using your SOW and service line standards as context.
          </p>

          {/* Requirements Run selector */}
          <div className="mt-3">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
              Requirements Context
            </label>
            {genRuns.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
                No completed requirements runs found — HLD will use SOW only.
              </p>
            ) : (
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                disabled={isRunning || starting}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 min-w-[280px]"
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

        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {isComplete && (
            <>
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 hover:border-violet-300 disabled:opacity-50 transition-all shadow-sm"
              >
                {exportingPdf
                  ? <><Loader2 size={12} className="animate-spin" /> Preparing...</>
                  : <><FileDown size={12} /> Export PDF</>}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 disabled:opacity-50 transition-all shadow-sm"
              >
                {exporting
                  ? <><Loader2 size={12} className="animate-spin" /> Exporting...</>
                  : <><FileDown size={12} /> Export Word</>}
              </button>
            </>
          )}
          {run && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={isRunning || starting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isRunning || starting ? (
              <><Loader2 size={12} className="animate-spin" /> Generating...</>
            ) : isComplete ? (
              <><RefreshCw size={12} /> Regenerate HLD</>
            ) : (
              <><Wand2 size={12} /> Generate HLD</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-xs">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Context used strip — shown when a run exists */}
      {run && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 mb-4 flex-wrap">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Generated with</span>
          <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${
            run.generation_run_id
              ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
              : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {run.generation_run_id
              ? `✓ Requirements Run #${run.generation_run_id}`
              : '⚠ No requirements run linked'}
          </span>
          <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${
            run.sow_id
              ? 'bg-green-50 text-green-600 border-green-200'
              : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {run.sow_id ? '✓ SOW linked' : '⚠ No SOW linked'}
          </span>
          <span className="text-[11px] px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-200 font-medium">
            ✓ M15 Standards
          </span>
        </div>
      )}

      {/* Progress bar when running */}
      {isRunning && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 size={16} className="animate-spin text-indigo-500" />
            <p className="text-sm font-medium text-indigo-700">
              {run.progress_message || 'Starting HLD generation...'}
            </p>
          </div>
          {(() => {
            const m     = run?.progress_message?.match(/\((\d+)\/(\d+)\)/)
            const done  = m ? parseInt(m[1]) : 0
            const total = m ? parseInt(m[2]) : 8
            const pct   = done > 0 ? Math.round((done / total) * 100) : 5
            return (
              <>
                <div className="w-full bg-indigo-200 rounded-full h-1.5">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-indigo-400 mt-2">{done} / {total} sections complete</p>
              </>
            )
          })()}
        </div>
      )}

      {/* Failed */}
      {isFailed && (
        <InfoBanner icon={AlertCircle} color="bg-red-50 border-red-200 text-red-700">
          HLD generation failed. {run.error_log || 'Unknown error.'} Click "Generate HLD" to retry.
        </InfoBanner>
      )}

      {/* No run yet */}
      {!run && !isRunning && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Wand2 size={22} className="text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">No HLD generated yet</p>
          <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
            Click "Generate HLD" to produce {HLD_SECTION_META.length} architecture documents using your SOW content and service
            line design standards.
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {HLD_SECTION_META.map((s) => (
              <span key={s.key} className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {isComplete && artifacts.length > 0 && (
        <HLDViewer
          artifacts={artifacts}
          runId={run.id}
          onSectionRegenerated={(updated) =>
            setArtifacts((prev) => {
              const exists = prev.some((a) => a.section_type === updated.section_type)
              if (exists) return prev.map((a) => a.section_type === updated.section_type ? updated : a)
              return [...prev, updated]
            })
          }
        />
      )}
    </div>
  )
}

// ── Main Detail Page ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'hld',          label: 'HLD Generation',          icon: Wand2      },
  { id: 'standards',    label: 'Service Line Standards',  icon: Layers     },
  { id: 'combinations', label: 'Platform Combinations',   icon: LayoutGrid },
]

export default function DesignProjectDetail() {
  const { projectId } = useParams()
  const navigate      = useNavigate()
  const [project,    setProject]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [activeTab,  setActiveTab]  = useState('hld')

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

  const serviceLines       = project.service_line?.split(',').map((s) => s.trim()).filter(Boolean) || []
  const relevantStandards  = filterByProject(project.service_line)
  const matchingCombos     = findMatchingCombos(project.service_line)

  return (
    <div className="p-8">
      {/* Back */}
      <button
        onClick={() => navigate('/design-studio')}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-5"
      >
        <ArrowLeft size={14} /> Back to Design Studio
      </button>

      {/* Project Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Compass size={22} className="text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h1 className="text-lg font-bold text-gray-900">{project.name}</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200">ACTIVE</span>
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
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all ${
                active
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {tab.id === 'standards' && relevantStandards.length > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-200 text-gray-500'}`}>
                  {relevantStandards.length}
                </span>
              )}
              {tab.id === 'combinations' && matchingCombos.length > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-200 text-gray-500'}`}>
                  {matchingCombos.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'hld'          && <HLDTab          project={project} />}
      {activeTab === 'standards'    && <StandardsTab    project={project} standards={relevantStandards} />}
      {activeTab === 'combinations' && <CombinationsTab project={project} combos={matchingCombos} />}
    </div>
  )
}
