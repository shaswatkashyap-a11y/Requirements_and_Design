import { useState, useEffect } from "react";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import {
  updatePrompt,
  saveProjectVersion,
  activatePrompt,
  deletePrompt,
  deactivateProjectOverride,
} from "../../api/promptApi";
import { PROMPT_SCHEMAS } from "../../config/promptSchemas";
import AddConfigModal from "./AddConfigModal";
import {
  deleteServiceLineByCode,
  deleteMethodologyByCode,
} from "../../api/configAdminApi";

function prettyPrintXml(xmlStr) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr.trim(), "application/xml");
    if (doc.querySelector("parsererror")) return xmlStr;

    function serialize(node, level = 0) {
      const indent = "  ".repeat(level);
      if (node.nodeType === 3) {
        const text = node.textContent.trim();
        return text ? text : null;
      }
      if (node.nodeType === 1) {
        const children = Array.from(node.childNodes).filter(
          (n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()),
        );
        if (children.length === 0)
          return `${indent}<${node.tagName}></${node.tagName}>`;
        const onlyText = children.every((c) => c.nodeType === 3);
        if (onlyText)
          return `${indent}<${node.tagName}>${node.textContent.trim()}</${node.tagName}>`;
        const childLines = children
          .map((c) => serialize(c, level + 1))
          .filter(Boolean);
        return [
          `${indent}<${node.tagName}>`,
          childLines.join("\n\n"),
          `${indent}</${node.tagName}>`,
        ].join("\n");
      }
      return null;
    }

    const root = doc.documentElement;
    const children = Array.from(root.childNodes).filter(
      (n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()),
    );
    const childLines = children.map((c) => serialize(c, 1)).filter(Boolean);
    return [
      `<${root.tagName}>`,
      childLines.join("\n\n"),
      `</${root.tagName}>`,
    ].join("\n");
  } catch {
    return xmlStr;
  }
}

function prettyPrintContent(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return prettyPrintXml(raw);
  }
}

function validatePromptContent(content, promptType, conceptKey) {
  if (promptType === "refinement") return null;

  if (
    promptType === "service_line_config" ||
    promptType === "methodology_config"
  ) {
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      return "Invalid JSON — fix the syntax before saving.";
    }
    const required =
      promptType === "methodology_config"
        ? ["document_title", "functional_req_heading", "artifact_order"]
        : ["terminology", "roles", "extra_sections"];
    for (const key of required) {
      if (!(key in data)) return `Missing required key: "${key}"`;
    }
    return null;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content.trim(), "application/xml");
  if (doc.querySelector("parsererror"))
    return "Invalid XML — fix the syntax before saving.";

  const schema = PROMPT_SCHEMAS[promptType]?.[conceptKey];
  if (!schema) return null;

  const root = doc.documentElement;
  if (root.tagName !== schema.root)
    return `Root element must be <${schema.root}>, found <${root.tagName}>.`;

  for (const tag of schema.required) {
    if (!root.querySelector(tag)) return `Missing required element <${tag}>.`;
  }

  if (schema.overrides) {
    const overridesEl = root.querySelector("artifact_overrides");
    if (overridesEl) {
      for (const tag of schema.overrides) {
        if (!overridesEl.querySelector(tag))
          return `Missing required override <${tag}> inside <artifact_overrides>.`;
      }
    }
  }

  return null;
}

function getConceptLabel(prompt) {
  return prompt.scope_key || prompt.artifact_type || prompt.section || "global";
}

export default function PromptEditPanel({
  prompt,
  projectId,
  hasProjectOverride,
  onSaved,
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (prompt) {
      setContent(prettyPrintContent(prompt.content));
      setError(null);
      setSaved(false);
      setEditing(false);
    }
  }, [prompt?.id]);

  if (!prompt) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Select a prompt to edit
      </div>
    );
  }

  const isGlobal = !prompt.project_id;
  const isActiveOverride = !isGlobal && prompt.is_active;
  const isConfigType =
    prompt.prompt_type === "methodology_config" ||
    prompt.prompt_type === "service_line_config";
  const isInactiveOverride = !isGlobal && !prompt.is_active;
  const isConfigurable = [
    "service_line",
    "methodology",
    "service_line_config",
    "methodology_config",
  ].includes(prompt.prompt_type);

  async function handleSave() {
    const conceptKey = prompt.scope_key || prompt.artifact_type;
    const validationError = validatePromptContent(
      content,
      prompt.prompt_type,
      conceptKey,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isGlobal && projectId) {
        await saveProjectVersion(prompt.id, projectId, content);
      } else {
        await updatePrompt(prompt.id, content);
      }
      setSaved(true);
      setEditing(false);
      onSaved?.();
    } catch (err) {
      const msg =
        err?.response?.data?.detail || "Failed to save. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${getConceptLabel(prompt)}"? This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    setError(null);
    try {
      if (
        prompt.prompt_type === "service_line" ||
        prompt.prompt_type === "service_line_config"
      ) {
        await deleteServiceLineByCode(prompt.scope_key);
      } else if (
        prompt.prompt_type === "methodology" ||
        prompt.prompt_type === "methodology_config"
      ) {
        await deleteMethodologyByCode(prompt.scope_key);
      } else {
        setError("This prompt type cannot be deleted from here.");
        return;
      }
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleOverride() {
    setOverriding(true);
    setError(null);
    try {
      if (isGlobal) {
        await deactivateProjectOverride(prompt.id, projectId);
      } else {
        await activatePrompt(prompt.id);
      }
      onSaved?.();
    } catch {
      setError("Failed. Please try again.");
    } finally {
      setOverriding(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {getConceptLabel(prompt)}
          </p>
          <p className="text-[10px] text-gray-400">
            {prompt.prompt_type} · last updated{" "}
            {new Date(prompt.updated_at).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isActiveOverride && (
            <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded">
              ● Active
            </span>
          )}
          {isInactiveOverride && projectId && (
            <button
              onClick={handleOverride}
              disabled={overriding}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-indigo-300 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors"
            >
              {overriding ? "Updating…" : "Activate Override"}
            </button>
          )}
          {isGlobal && projectId && hasProjectOverride && (
            <button
              onClick={handleOverride}
              disabled={overriding}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {overriding ? "Updating…" : "Revert to Global"}
            </button>
          )}

          {isConfigurable && (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                {deleting ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Trash2 size={11} />
                )}
                Delete
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <Plus size={11} />
                Add
              </button>
            </>
          )}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  setContent(prettyPrintContent(prompt.content));
                  setError(null);
                }}
                className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={11} /> Save
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Feedback ── */}
      {error && (
        <p className="text-[11px] text-red-500 px-4 py-2 bg-red-50">{error}</p>
      )}
      {saved && (
        <p className="text-[11px] text-green-600 px-4 py-2 bg-green-50">
          {isGlobal && projectId
            ? 'Saved as project version. Select it from the list and click "Activate Override" to use it.'
            : "Saved."}
        </p>
      )}

      {/* ── Context banners ── */}
      {isGlobal && projectId && (
        <p className="text-[11px] text-blue-600 px-4 py-2 bg-blue-50 border-b border-blue-100">
          Global prompt — Save creates an inactive project-specific version.
          Activate it from the list to use it in generation.
        </p>
      )}
      {isInactiveOverride && (
        <p className="text-[11px] text-amber-600 px-4 py-2 bg-amber-50 border-b border-amber-100">
          Saved but not active — click "Activate Override" to make the
          orchestrator use this version.
        </p>
      )}
      {isActiveOverride && (
        <p className="text-[11px] text-indigo-600 px-4 py-2 bg-indigo-50 border-b border-indigo-100">
          Active override — orchestrator uses this version for this project.
          Select the global row and click "Revert to Global" to deactivate.
        </p>
      )}

      {/* ── Editor ── */}
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSaved(false);
        }}
        readOnly={!editing}
        className={`flex-1 p-4 text-xs font-mono resize-none focus:outline-none ${
          !editing
            ? "bg-gray-50 text-gray-500 cursor-default"
            : "bg-white text-gray-800"
        }`}
        spellCheck={false}
      />

      {/* ── Add Config Modal ── */}
      {showAddModal && (
        <AddConfigModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
