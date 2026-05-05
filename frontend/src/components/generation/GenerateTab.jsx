import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  History,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import GenerationConfig from "./GenerationConfig";
import GenerationHistory from "./GenerationHistory";
import {
  startGeneration,
  fetchProjectGenerations,
} from "../../api/generationApi";
import { fetchPrompts } from "../../api/promptApi";
import PromptList from "../prompts/PromptList";
import PromptEditPanel from "../prompts/PromptEditPanel";

export default function GenerateTab({ projectId, sowId, project }) {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [prompts, setPrompts] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [promptsLoading, setPromptsLoading] = useState(false);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const all = await fetchProjectGenerations(projectId);
      const forThisSow = all.filter((r) => String(r.sow_id) === String(sowId));
      setRuns(forThisSow);
    } catch {
      // non-fatal
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadPrompts({ showSpinner = true } = {}) {
    if (showSpinner) setPromptsLoading(true);
    try {
      const data = await fetchPrompts(projectId ? Number(projectId) : null);
      setPrompts(data);
      // Re-sync selectedPrompt to the refreshed version of the same row
      // so the panel reflects updated is_active/content without losing selection
      setSelectedPrompt((prev) =>
        prev ? (data.find((p) => p.id === prev.id) ?? prev) : null,
      );
    } catch {
      // non-fatal
    } finally {
      if (showSpinner) setPromptsLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [projectId, sowId]);

  useEffect(() => {
    if (promptsOpen && prompts.length === 0) loadPrompts({ showSpinner: true });
  }, [promptsOpen]);

  async function handleGenerate(config) {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const result = await startGeneration(projectId, sowId, config);
      navigate(
        `/projects/${projectId}/generations/${result.generation_run_id}`,
      );
    } catch (err) {
      setGenerateError(
        err.message || "Failed to start generation. Please try again.",
      );
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Buttons row ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setConfigOpen((o) => !o);
              setPromptsOpen(false);
              setGenerateError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Cpu size={14} />
            New Generation
            {configOpen ? (
              <ChevronUp size={13} className="ml-1 opacity-70" />
            ) : (
              <ChevronDown size={13} className="ml-1 opacity-70" />
            )}
          </button>

          <button
            onClick={() => {
              setPromptsOpen((o) => !o);
              setConfigOpen(false);
              setGenerateError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <SlidersHorizontal size={14} />
            Configure Prompts
            {promptsOpen ? (
              <ChevronUp size={13} className="ml-1 opacity-70" />
            ) : (
              <ChevronDown size={13} className="ml-1 opacity-70" />
            )}
          </button>
        </div>

        {/* Expandable generation config panel */}
        {configOpen && (
          <div className="mt-3 bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-5">
            {generateError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                {generateError}
              </div>
            )}
            <GenerationConfig
              project={project}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </div>
        )}

        {/* Expandable prompts panel */}
        {promptsOpen && (
          <div
            className="mt-3 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
            style={{ height: "480px" }}
          >
            {promptsLoading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <Loader2 size={16} className="animate-spin mr-2" />
                <span className="text-sm">Loading prompts…</span>
              </div>
            ) : (
              <div className="flex h-full min-h-0">
                <PromptList
                  prompts={prompts}
                  selectedId={selectedPrompt?.id}
                  onSelect={setSelectedPrompt}
                />
                <PromptEditPanel
                  prompt={selectedPrompt}
                  projectId={projectId ? Number(projectId) : null}
                  onSaved={() => loadPrompts({ showSpinner: false })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Generation History ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">
            Generation History
          </h2>
          {!loadingHistory && runs.length > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
              {runs.length}
            </span>
          )}
          <button
            onClick={loadHistory}
            className="ml-auto text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Refresh
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-sm">Loading history…</span>
          </div>
        ) : (
          <GenerationHistory
            runs={runs}
            projectId={projectId}
            onRunsChange={loadHistory}
          />
        )}
      </div>
    </div>
  );
}
