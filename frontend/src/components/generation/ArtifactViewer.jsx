import { useState, useEffect, useRef } from 'react'
import { Loader2, History } from 'lucide-react'
import { fetchModuleArtifacts } from '../../api/generationApi'
import useRefineArtifact from '../../hooks/useRefineArtifact'
import RefinementPanel from '../refinement/RefinementPanel'
import StaleBanner from '../refinement/StaleBanner'
import VersionHistoryDrawer from '../refinement/VersionHistoryDrawer'
import FunctionalReqCard from './FunctionalReqCard'
import NonFunctionalReqCard from './NonFunctionalReqCard'
import TaskCard from './TaskCard'
import TestCaseCard from './TestCaseCard'
import ArchitectureCard from './ArchitectureCard'
import RiskCard from './RiskCard'

const ARTIFACT_TABS = [
  { type: 'functional_req',    label: 'Requirements',   shortLabel: 'Req.' },
  { type: 'nonfunctional_req', label: 'Non-Functional', shortLabel: 'Non-Func.' },
  { type: 'task',              label: 'Tasks',          shortLabel: 'Tasks' },
  { type: 'test_case',         label: 'Test Cases',     shortLabel: 'Tests' },
  { type: 'architecture',      label: 'Architecture',   shortLabel: 'Arch.' },
  { type: 'risk_entry',        label: 'Risks',          shortLabel: 'Risks' },
]

function renderTypedCard(artifact, onLinkedReqClick) {
  switch (artifact.artifact_type) {
    case 'functional_req':    return <FunctionalReqCard artifact={artifact} />
    case 'nonfunctional_req': return <NonFunctionalReqCard artifact={artifact} />
    case 'task':              return <TaskCard artifact={artifact} onLinkedReqClick={onLinkedReqClick} />
    case 'test_case':         return <TestCaseCard artifact={artifact} />
    case 'architecture':      return <ArchitectureCard artifact={artifact} />
    case 'risk_entry':        return <RiskCard artifact={artifact} />
    default:
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-1">{artifact.title}</p>
          <pre className="text-[11px] text-gray-500 whitespace-pre-wrap">
            {JSON.stringify(artifact.content_json, null, 2)}
          </pre>
        </div>
      )
  }
}

function ArtifactCard({ artifact, runId, onRefineSuccess, onLinkedReqClick }) {
  const [showHistory, setShowHistory] = useState(false)
  const { refine, saveEdit }          = useRefineArtifact(runId, onRefineSuccess)

  function handleRegenerate() {
    refine(
      artifact.id,
      'Re-generate this artifact to align with the latest upstream changes.',
      false,
    )
  }

  return (
    <div className="relative">
      {artifact.stale_status === 'stale' && (
        <StaleBanner
          artifact     ={artifact}
          runId        ={runId}
          onDismiss    ={onRefineSuccess}
          onRegenerate ={handleRegenerate}
        />
      )}

      <div className="relative">
        <button
          onClick   ={() => setShowHistory(true)}
          className ="absolute top-3 right-3 text-gray-300 hover:text-gray-500 z-10"
          title     ="Version history"
        >
          <History size={13} />
        </button>
        {renderTypedCard(artifact, onLinkedReqClick)}
      </div>

      <RefinementPanel
        artifact   ={artifact}
        runId      ={runId}
        onRefine   ={(id, feedback) => refine(id, feedback)}
        onSaveEdit ={(id, md, json) => saveEdit(id, md, json)}
      />

      {showHistory && (
        <VersionHistoryDrawer
          artifact ={artifact}
          runId    ={runId}
          onClose  ={() => setShowHistory(false)}
          onRestore={onRefineSuccess}
        />
      )}
    </div>
  )
}

export default function ArtifactViewer({ runId, module: mod, topContent }) {
  const [activeType, setActiveType] = useState(null)
  const [artifacts, setArtifacts]   = useState([])
  const [counts, setCounts]         = useState({})
  const [loading, setLoading]       = useState(false)
  const highlightedReqRef           = useRef(null)

  useEffect(() => {
    if (!mod) return
    setActiveType(null)
    setCounts({})
    setArtifacts([])

    async function loadAllCounts() {
      const results = {}
      await Promise.all(
        ARTIFACT_TABS.map(async ({ type }) => {
          try {
            const data = await fetchModuleArtifacts(runId, mod.id, type)
            results[type] = data.length
          } catch {
            results[type] = 0
          }
        })
      )
      setCounts(results)
      const firstWithArtifacts = ARTIFACT_TABS.find(({ type }) => results[type] > 0)
      if (firstWithArtifacts) setActiveType(firstWithArtifacts.type)
    }
    loadAllCounts()
  }, [mod?.id, runId])

  useEffect(() => {
    if (!activeType || !mod) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await fetchModuleArtifacts(runId, mod.id, activeType)
        if (!cancelled) setArtifacts(data)
      } catch {
        if (!cancelled) setArtifacts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeType, mod?.id, runId])

  async function reloadCurrentTab() {
    if (!activeType || !mod) return
    setLoading(true)
    try {
      const data = await fetchModuleArtifacts(runId, mod.id, activeType)
      setArtifacts(data)
    } finally {
      setLoading(false)
    }
  }

  function handleLinkedReqClick(reqId) {
    setActiveType('functional_req')
    highlightedReqRef.current = reqId
  }

  const visibleTabs = ARTIFACT_TABS.filter(({ type }) => (counts[type] || 0) > 0)

  if (!mod) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p className="text-sm">Select a module to view its artifacts</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Module header — hidden when a topContent panel is provided (it shows name/desc already) */}
      {!topContent && (
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4 bg-white">
          <h2 className="text-sm font-bold text-gray-900">{mod.name}</h2>
          {mod.description && (
            <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
          )}
          {mod.source_section_ids?.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <span className="text-[10px] text-gray-400">Sources:</span>
              {mod.source_section_ids.map((id) => (
                <span key={id} className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 rounded border border-gray-200">
                  §{id}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab bar — always pinned so switching artifact types stays accessible while scrolling */}
      {visibleTabs.length > 0 && (
        <div className="flex-shrink-0 flex gap-0 border-b border-gray-200 bg-white overflow-x-auto">
          {visibleTabs.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors -mb-px ${
                activeType === type
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {counts[type] > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeType === type ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {counts[type]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Single scroll container — topContent and artifact cards scroll together */}
      <div className="flex-1 overflow-y-auto">
        {topContent && (
          <div className="px-5 pt-4">
            {topContent}
          </div>
        )}
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={18} className="animate-spin mr-2" />
              <span className="text-sm">Loading artifacts…</span>
            </div>
          ) : artifacts.length > 0 ? (
            <div className="space-y-4">
              {artifacts.map((artifact) => (
                <ArtifactCard
                  key             ={artifact.id}
                  artifact        ={artifact}
                  runId           ={runId}
                  onRefineSuccess ={reloadCurrentTab}
                  onLinkedReqClick={handleLinkedReqClick}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">
              No artifacts found for this type.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
