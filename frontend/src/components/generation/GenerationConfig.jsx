import { useState, useEffect } from 'react'
import { Loader2, Cpu } from 'lucide-react'
import { fetchMethodologies, fetchServiceLines, fetchArtifactTypes } from '../../api/generationApi'

const ARTIFACT_DISPLAY_NAMES = {
  functional_req:       'Functional Requirements',
  nonfunctional_req:    'Non-Functional Requirements',
  task:                 'Tasks',
  test_case:            'Test Cases',
  architecture:         'Architecture',
  risk_entry:           'Risks',
  component_design:     'Component Design',
  data_model:           'Data Model',
  traceability_matrix:  'Traceability Matrix',
}

export default function GenerationConfig({ project, onGenerate, isGenerating }) {
  const [methodologies, setMethodologies] = useState([])
  const [serviceLineGroups, setServiceLineGroups] = useState([])
  const [selectedMethodology, setSelectedMethodology] = useState('')
  const [selectedServiceLines, setSelectedServiceLines] = useState([])
  const [artifactTypes, setArtifactTypes] = useState([])
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [loadingArtifacts, setLoadingArtifacts] = useState(false)
  // Track if the user has manually changed the selectors (so we don't override their choice)
  const userTouched = useState(false)

  // Pre-fill from project data when it arrives (only if user hasn't touched the fields)
  useEffect(() => {
    if (!project || userTouched[0]) return
    if (project.methodology) {
      setSelectedMethodology(project.methodology.toLowerCase())
    }
    if (project.service_line) {
      const codes = project.service_line
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      setSelectedServiceLines(codes)
    }
  }, [project])

  useEffect(() => {
    async function loadConfig() {
      try {
        const [meths, sls] = await Promise.all([fetchMethodologies(), fetchServiceLines()])
        setMethodologies(meths)
        setServiceLineGroups(sls)
      } catch {
        // ignore — dropdowns just won't populate
      } finally {
        setLoadingConfig(false)
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    if (!selectedMethodology || selectedServiceLines.length === 0) {
      setArtifactTypes([])
      return
    }
    let cancelled = false
    async function loadArtifacts() {
      setLoadingArtifacts(true)
      try {
        const data = await fetchArtifactTypes(selectedMethodology, selectedServiceLines)
        if (!cancelled) setArtifactTypes(data.artifact_types || [])
      } catch {
        if (!cancelled) setArtifactTypes([])
      } finally {
        if (!cancelled) setLoadingArtifacts(false)
      }
    }
    loadArtifacts()
    return () => { cancelled = true }
  }, [selectedMethodology, selectedServiceLines.join(',')])

  function toggleServiceLine(code) {
    userTouched[1](true)
    setSelectedServiceLines((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const canGenerate = selectedMethodology && selectedServiceLines.length > 0 && !isGenerating

  function handleGenerate() {
    if (!canGenerate) return
    onGenerate({
      methodology: selectedMethodology,
      service_line_codes: selectedServiceLines,
      artifact_types: null,
    })
  }

  if (loadingConfig) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-6">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading configuration…</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Auto-fill notice */}
      {project && (project.methodology || project.service_line) && !userTouched[0] && (
        <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
          <span className="font-semibold">Auto-filled</span>
          <span className="text-indigo-400">from project settings — you can change these before generating.</span>
        </div>
      )}

      {/* Methodology */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
          Methodology
        </label>
        <select
          value={selectedMethodology}
          onChange={(e) => { userTouched[1](true); setSelectedMethodology(e.target.value) }}
          className="w-full max-w-xs text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          disabled={isGenerating}
        >
          <option value="">Select methodology…</option>
          {methodologies.map((m) => (
            <option key={m.id} value={m.code}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Service Lines */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
          Service Lines
        </label>
        <div className="space-y-3">
          {serviceLineGroups.map((group) => (
            <div key={group.id}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                {group.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(group.service_lines || []).map((sl) => {
                  const active = selectedServiceLines.includes(sl.code)
                  return (
                    <button
                      key={sl.code}
                      onClick={() => toggleServiceLine(sl.code)}
                      disabled={isGenerating}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {sl.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {selectedServiceLines.length > 0 && (
          <p className="text-[10px] text-gray-400 mt-2">
            {selectedServiceLines.length} service line{selectedServiceLines.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Artifact Types Preview */}
      {(selectedMethodology && selectedServiceLines.length > 0) && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Artifacts to Generate
          </label>
          {loadingArtifacts ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-xs">Resolving artifact types…</span>
            </div>
          ) : artifactTypes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {artifactTypes.map((type) => (
                <span
                  key={type}
                  className="text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded"
                >
                  {ARTIFACT_DISPLAY_NAMES[type] || type}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No artifact types resolved for this combination.</p>
          )}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          canGenerate
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isGenerating ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Starting generation…
          </>
        ) : (
          <>
            <Cpu size={15} />
            Generate All
          </>
        )}
      </button>
    </div>
  )
}
