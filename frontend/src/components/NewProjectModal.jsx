import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { fetchMethodologies } from '../api/generationApi'

const SERVICE_LINE_GROUPS = [
  {
    label: 'CRM & ERP PLATFORMS',
    color: 'text-purple-600',
    items: [
      { id: 'salesforce', label: 'Salesforce' },
      { id: 'netsuite', label: 'NetSuite' },
      { id: 'sap', label: 'SAP' },
      { id: 'oracle', label: 'Oracle Applications' },
    ],
  },
  {
    label: 'ITSM & WORKFLOW',
    color: 'text-green-600',
    items: [{ id: 'servicenow', label: 'ServiceNow' }],
  },
  {
    label: 'CUSTOM DEVELOPMENT',
    color: 'text-blue-600',
    items: [
      { id: 'dotnet', label: '.NET' },
      { id: 'python', label: 'Python' },
      { id: 'java', label: 'Java' },
    ],
  },
  {
    label: 'FRONTEND FRAMEWORKS',
    color: 'text-orange-500',
    items: [
      { id: 'react', label: 'React' },
      { id: 'angular', label: 'Angular' },
    ],
  },
  {
    label: 'AI & INTELLIGENCE',
    color: 'text-red-500',
    items: [
      { id: 'agentic_ai', label: 'Agentic AI' },
      { id: 'ai_ml', label: 'AI/ML' },
      { id: 'data_ai', label: 'Data & AI' },
    ],
  },
  {
    label: 'CLOUD PLATFORMS',
    color: 'text-sky-500',
    items: [
      { id: 'azure', label: 'Azure' },
      { id: 'aws', label: 'AWS' },
      { id: 'gcp', label: 'GCP' },
    ],
  },
]

const PROJECT_TYPES = [
  { value: 'ams',            label: 'AMS / RUN Services',        hint: 'Managed services, support, SLA-based engagement' },
  { value: 'implementation', label: 'Platform Implementation',   hint: 'Salesforce / ServiceNow implementation or rollout' },
  { value: 'integration',    label: 'Integration / Middleware',  hint: 'Connecting existing systems via APIs or middleware' },
  { value: 'custom_dev',     label: 'Custom Development',        hint: 'Building new software or applications' },
  { value: 'data_analytics', label: 'Data & Analytics',          hint: 'Data pipelines, dashboards, warehouses' },
]

const empty = {
  name: '',
  client_name: '',
  description: '',
  engagement_model: '',
  methodology: '',
  project_type: '',
  service_line: [],
}

export default function NewProjectModal({ onClose, onSubmit, loading }) {
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})
  const [methodologies, setMethodologies] = useState([])

  useEffect(() => {
    fetchMethodologies()
      .then(setMethodologies)
      .catch(() => {}) // dropdown stays empty on error; user can still type
  }, [])

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const toggleService = (id) => {
    setForm((f) => ({
      ...f,
      service_line: f.service_line.includes(id)
        ? f.service_line.filter((s) => s !== id)
        : [...f.service_line, id],
    }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Project name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSubmit({
      ...form,
      service_line: form.service_line.join(', '),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Create New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. CRM Modernization Phase 2"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Client Name</label>
            <input
              type="text"
              placeholder="e.g. Acme Corp"
              value={form.client_name}
              onChange={(e) => set('client_name', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              placeholder="Brief project description..."
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Engagement Model + Methodology */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Engagement Model</label>
              <select
                value={form.engagement_model}
                onChange={(e) => set('engagement_model', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700 appearance-none"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              >
                <option value="">Select model</option>
                <option value="Time & Material">Time &amp; Material</option>
                <option value="Fixed Price">Fixed Price</option>
                <option value="Outcome-Based">Outcome-Based</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Retainer">Retainer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Methodology</label>
              <select
                value={form.methodology}
                onChange={(e) => set('methodology', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700 appearance-none"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              >
                <option value="">Select methodology</option>
                {methodologies.map((m) => (
                  <option key={m.id} value={m.code}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Project Type <span className="text-gray-400 font-normal">(helps AI generate accurate design)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((pt) => {
                const active = form.project_type === pt.value
                return (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => set('project_type', active ? '' : pt.value)}
                    title={pt.hint}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                      active
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {pt.label}
                  </button>
                )
              })}
            </div>
            {form.project_type && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                {PROJECT_TYPES.find((pt) => pt.value === form.project_type)?.hint}
              </p>
            )}
          </div>

          {/* Service Lines */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-3">
              Service Lines <span className="text-gray-400 font-normal">(select applicable)</span>
            </label>
            <div className="space-y-3">
              {SERVICE_LINE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className={`text-[10px] font-bold tracking-wider mb-1.5 ${group.color}`}>
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => {
                      const active = form.service_line.includes(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleService(item.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all ${
                            active
                              ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <Plus size={14} />
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}