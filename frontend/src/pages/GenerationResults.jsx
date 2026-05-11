import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, Loader2, BarChart2, ExternalLink, CheckCircle2, X } from "lucide-react";
import {
  fetchGenerationStatus,
  fetchGenerationModules,
} from "../api/generationApi";
import ModuleNavigator from "../components/generation/ModuleNavigator";
import ArtifactViewer from "../components/generation/ArtifactViewer";
import ModuleEditPanel from "../components/generation/ModuleEditPanel";
import ResultsSummary from "../components/generation/ResultsSummary";
import StatusBadge from "../components/common/StatusBadge";
import ValidationReport from "../components/generation/ValidationReport";
import ExportPanel from "../components/generation/ExportPanel";
import { pushToJira, fetchJiraConfig } from "../api/jiraApi";

// ── Push to Jira Modal ────────────────────────────────────────────────────────
function JiraPushModal({ projectId, runId, modules, onClose }) {
  // Pre-select only modules that haven't been pushed yet
  const [selectedIds, setSelectedIds]   = useState(modules.filter((m) => !m.jira_epic_key).map((m) => m.id))
  const [pushTasks,   setPushTasks]     = useState(true)
  const [pushNfrs,    setPushNfrs]      = useState(true)
  const [forceRepush, setForceRepush]   = useState(false)
  const [pushing,     setPushing]       = useState(false)
  const [result,      setResult]        = useState(null)
  const [pushError,   setPushError]     = useState(null)

  const toggle = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  const handlePush = async () => {
    if (!selectedIds.length) return
    setPushing(true)
    setPushError(null)
    try {
      const res = await pushToJira(Number(projectId), {
        generation_run_id: Number(runId),
        module_ids:        selectedIds,
        push_tasks:        pushTasks,
        push_nfrs:         pushNfrs,
        create_nfr_epic:   pushNfrs,
        force_repush:      forceRepush,
      })
      setResult(res)
    } catch (e) {
      setPushError(e.message)
    } finally {
      setPushing(false)
    }
  }

  // Ensure jira_url always has a protocol so hrefs open Jira, not a relative path
  const jiraBase = result
    ? (result.jira_url?.startsWith('http') ? result.jira_url : `https://${result.jira_url}`)
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Push to Jira</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Select modules to push as Epics</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {result ? (
            // Success view
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                <CheckCircle2 size={16} /> {result.total_created} issues created in Jira
              </div>
              {result.nfr_epic_key && (
                <p className="text-xs text-gray-500">
                  NFR Epic:{' '}
                  <a
                    href={`${jiraBase}/browse/${result.nfr_epic_key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-semibold text-indigo-600 hover:underline"
                  >
                    {result.nfr_epic_key} <ExternalLink size={10} className="inline" />
                  </a>
                </p>
              )}
              <div className="space-y-2">
                {result.modules.map((m) => (
                  <div key={m.module_id} className="border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-800">{m.module_name}</span>
                      <a
                        href={`${jiraBase}/browse/${m.epic_key}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
                      >
                        {m.epic_key} <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="flex gap-3 text-[11px] text-gray-500 flex-wrap">
                      <span>{m.stories.length} stories</span>
                      <span>{m.tasks.length} tasks</span>
                      {m.nfr_stories?.length > 0 && <span>{m.nfr_stories.length} NFRs</span>}
                      {m.skipped?.length > 0 && <span className="text-amber-500">{m.skipped.length} skipped (already in Jira)</span>}
                      {m.errors?.length > 0 && <span className="text-red-500">{m.errors.length} errors</span>}
                    </div>
                  </div>
                ))}
              </div>
              {result.errors?.length > 0 && (
                <details className="text-xs text-red-600">
                  <summary className="cursor-pointer">Show {result.errors.length} error(s)</summary>
                  <ul className="mt-1 space-y-1 pl-3">{result.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
                </details>
              )}
            </div>
          ) : (
            <>
              {/* Module selection */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Select Modules ({selectedIds.length}/{modules.length})
                </p>
                <div className="space-y-1.5">
                  {modules.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(m.id)}
                        onChange={() => toggle(m.id)}
                        className="rounded text-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>
                        {m.jira_epic_key && (
                          <p className="text-[10px] text-indigo-500">Already pushed: {m.jira_epic_key}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Options</p>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={pushTasks} onChange={(e) => setPushTasks(e.target.checked)} className="rounded text-indigo-600" />
                  Push Tasks as Jira Tasks (linked to parent Stories)
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={pushNfrs} onChange={(e) => setPushNfrs(e.target.checked)} className="rounded text-indigo-600" />
                  Push Non-Functional Requirements (grouped in NFR Epic)
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={forceRepush} onChange={(e) => setForceRepush(e.target.checked)} className="rounded text-amber-600" />
                  <span className={forceRepush ? 'text-amber-700 font-medium' : 'text-gray-500'}>
                    Force re-push (re-create already-pushed issues)
                  </span>
                </label>
              </div>

              {/* Mapping preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-[11px] text-gray-600">
                <p className="font-semibold mb-1">What will be created:</p>
                <p>📁 Module → <strong>Epic</strong></p>
                <p>📄 Functional Req → <strong>Story</strong> (under Epic)</p>
                {pushTasks  && <p>✅ Task → <strong>Task</strong> (linked to Story)</p>}
                {pushNfrs   && <p>⚙️ NFR → <strong>Story</strong> (under shared NFR Epic)</p>}
              </div>

              {pushError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">
                  <AlertCircle size={12} /> {pushError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handlePush}
              disabled={pushing || !selectedIds.length}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pushing ? <><Loader2 size={12} className="animate-spin" /> Pushing...</> : <>Push {selectedIds.length} module{selectedIds.length !== 1 ? 's' : ''} →</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GenerationResults() {
  const { projectId, runId } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState("artifacts");
  const [artifactRefreshKey, setArtifactRefreshKey] = useState(0);
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [jiraConfigured, setJiraConfigured] = useState(false);

  useEffect(() => {
    fetchJiraConfig(projectId)
      .then((cfg) => setJiraConfigured(cfg.configured))
      .catch(() => {})
  }, [projectId])

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [runData, modulesData] = await Promise.all([
          fetchGenerationStatus(runId),
          fetchGenerationModules(runId),
        ]);
        setRun(runData);
        const sorted = [...modulesData].sort(
          (a, b) => (a.module_order ?? 0) - (b.module_order ?? 0),
        );
        setModules(sorted);
        if (sorted.length > 0) setSelectedModuleId(sorted[0].id);
      } catch (err) {
        setError(err.message || "Failed to load results.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [runId]);

  const selectedModule = modules.find((m) => m.id === selectedModuleId) || null;

  function handleModuleUpdated(updatedModule) {
    setModules((prev) =>
      prev.map((m) =>
        m.id === updatedModule.id ? { ...m, ...updatedModule } : m,
      ),
    );
  }

  function handleArtifactsRegenerated() {
    setArtifactRefreshKey((k) => k + 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">Loading results…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          <AlertCircle size={14} />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                navigate(`/projects/${projectId}/sow/${run?.sow_id || ""}`)
              }
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to SOW
            </button>
            <div className="w-px h-4 bg-gray-200" />
            <div>
              <span className="text-sm font-bold text-gray-900">
                Generation Run #{run?.id}
              </span>
              <span className="text-gray-300 mx-2">·</span>
              {run && <StatusBadge status={run.status} />}
              {run?.methodology && (
                <span className="ml-2 text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded capitalize">
                  {run.methodology}
                </span>
              )}
              {(run?.service_line_codes || []).map((sl) => (
                <span
                  key={sl}
                  className="ml-1 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded"
                >
                  {sl}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Push to Jira */}
            {run?.status === 'completed' && (
              <button
                onClick={() => setShowJiraModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  jiraConfigured
                    ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'
                    : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                }`}
                title={jiraConfigured ? 'Push requirements to Jira' : 'Configure Jira in project settings first'}
                disabled={!jiraConfigured}
              >
                <ExternalLink size={11} />
                Push to Jira
                {!jiraConfigured && <span className="text-[10px]">(not configured)</span>}
              </button>
            )}

          {/* View toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setActiveView("artifacts")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === "artifacts"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Artifacts
            </button>
            <button
              onClick={() => setActiveView("summary")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === "summary"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <BarChart2 size={11} />
              Summary
            </button>
            <button
              onClick={() => setActiveView("validate")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === "validate"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Validate
            </button>
            <button
              onClick={() => setActiveView("export")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === "export"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Export
            </button>
          </div>
          </div>
        </div>
      </div>

      {showJiraModal && (
        <JiraPushModal
          projectId={projectId}
          runId={runId}
          modules={modules}
          onClose={() => setShowJiraModal(false)}
        />
      )}

      {activeView === "export" ? (
        <ExportPanel run={run} modules={modules} runId={runId} />
      ) : activeView === "validate" ? (
        <div className="flex-1 overflow-y-auto p-6">
          <ValidationReport runId={runId} />
        </div>
      ) : activeView === "summary" ? (
        <div className="flex-1 overflow-y-auto p-6">
          <ResultsSummary run={run} modules={modules} runId={runId} />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left: Module Navigator */}
          <div
            className="flex-shrink-0 border-r border-gray-200 bg-white overflow-hidden flex flex-col"
            style={{ width: "240px" }}
          >
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Modules
              </p>
            </div>
            {modules.length > 0 ? (
              <ModuleNavigator
                modules={modules}
                selectedId={selectedModuleId}
                onSelect={setSelectedModuleId}
              />
            ) : (
              <p className="text-xs text-gray-400 text-center py-8 px-4">
                No modules found.
              </p>
            )}
          </div>

          {/* Right: Artifact Viewer — ModuleEditPanel passed as topContent so it scrolls with artifacts */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-gray-50">
            <ArtifactViewer
              key={`${selectedModuleId}-${artifactRefreshKey}`}
              runId={runId}
              module={selectedModule}
              topContent={
                selectedModule ? (
                  <ModuleEditPanel
                    runId={runId}
                    module={selectedModule}
                    onModuleUpdated={handleModuleUpdated}
                    onArtifactsRegenerated={handleArtifactsRegenerated}
                  />
                ) : null
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
