import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, Loader2, BarChart2 } from "lucide-react";
import {
  fetchGenerationStatus,
  fetchGenerationModules,
} from "../api/generationApi";
import ModuleNavigator from "../components/generation/ModuleNavigator";
import ArtifactViewer from "../components/generation/ArtifactViewer";
import ResultsSummary from "../components/generation/ResultsSummary";
import StatusBadge from "../components/common/StatusBadge";
import ValidationReport from "../components/generation/ValidationReport";

export default function GenerationResults() {
  const { projectId, runId } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState("artifacts"); // 'artifacts' | 'summary' | 'validate'

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [runData, modulesData] = await Promise.all([
          fetchGenerationStatus(runId),
          fetchGenerationModules(runId),
        ]);
        setRun(runData);
        // Sort by module_order
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
          </div>
        </div>
      </div>

      {activeView === "validate" ? (
        <div className="flex-1 overflow-y-auto p-6">
          <ValidationReport runId={runId} />
        </div>
      ) : activeView === "summary" ? (
        <div className="flex-1 overflow-y-auto p-6">
          <ResultsSummary run={run} modules={modules} runId={runId} />
        </div>
      ) : (
        /* Artifacts view: left sidebar + main content */
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

          {/* Right: Artifact Viewer */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-gray-50">
            <ArtifactViewer runId={runId} module={selectedModule} />
          </div>
        </div>
      )}
    </div>
  );
}
