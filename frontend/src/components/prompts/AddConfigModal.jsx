import { useState, useRef, useEffect } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { fetchServiceLines } from '../../api/generationApi'
import { addServiceLine, addMethodology } from '../../api/configAdminApi'

const TABS = ['Service Line', 'Methodology']

function FileDropZone({ label, file, accept, onChange }) {
  const ref = useRef()
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label} *</label>
      <div
        onClick={() => ref.current.click()}
        className="border border-dashed border-gray-300 rounded-lg px-3 py-3 flex items-center gap-2 cursor-pointer hover:border-blue-400 transition-colors"
      >
        <Upload size={13} className="text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-500 truncate">
          {file ? file.name : `Click to upload ${accept}`}
        </span>
      </div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files[0] || null)}
      />
    </div>
  )
}

function ServiceLineForm({ onClose, onAdded }) {
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [icon, setIcon] = useState('')
  const [xmlFile, setXmlFile] = useState(null)
  const [yamlFile, setYamlFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchServiceLines()
      .then((groups) => setCategories(groups.map((g) => ({ id: g.id, name: g.name }))))
      .catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required')
    if (!categoryId) return setError('Category is required')
    if (!xmlFile) return setError('XML file is required')
    if (!yamlFile) return setError('YAML file is required')

    const fd = new FormData()
    fd.append('name', name.trim())
    fd.append('category_id', categoryId)
    if (icon.trim()) fd.append('icon', icon.trim())
    fd.append('xml_file', xmlFile)
    fd.append('yaml_file', yamlFile)

    setLoading(true)
    setError('')
    try {
      await addServiceLine(fd)
      onAdded?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. React Native"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Icon (optional)</label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="e.g. react"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <FileDropZone label="Prompt XML file" file={xmlFile} accept=".xml" onChange={setXmlFile} />
      <FileDropZone label="Config YAML file" file={yamlFile} accept=".yaml,.yml" onChange={setYamlFile} />
      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-blue-600 text-white text-xs py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5 transition-colors">
          {loading && <Loader2 size={12} className="animate-spin" />}
          {loading ? 'Adding…' : 'Add Service Line'}
        </button>
      </div>
    </form>
  )
}

function MethodologyForm({ onClose, onAdded }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [xmlFile, setXmlFile] = useState(null)
  const [yamlFile, setYamlFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required')
    if (!xmlFile) return setError('XML file is required')
    if (!yamlFile) return setError('YAML file is required')

    const fd = new FormData()
    fd.append('name', name.trim())
    if (description.trim()) fd.append('description', description.trim())
    fd.append('xml_file', xmlFile)
    fd.append('yaml_file', yamlFile)

    setLoading(true)
    setError('')
    try {
      await addMethodology(fd)
      onAdded?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kanban"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <FileDropZone label="Prompt XML file" file={xmlFile} accept=".xml" onChange={setXmlFile} />
      <FileDropZone label="Config YAML file" file={yamlFile} accept=".yaml,.yml" onChange={setYamlFile} />
      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-blue-600 text-white text-xs py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5 transition-colors">
          {loading && <Loader2 size={12} className="animate-spin" />}
          {loading ? 'Adding…' : 'Add Methodology'}
        </button>
      </div>
    </form>
  )
}

export default function AddConfigModal({ onClose, onAdded }) {
  const [activeTab, setActiveTab] = useState('Service Line')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Add Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Service Line'
          ? <ServiceLineForm onClose={onClose} onAdded={onAdded} />
          : <MethodologyForm onClose={onClose} onAdded={onAdded} />
        }
      </div>
    </div>
  )
}
