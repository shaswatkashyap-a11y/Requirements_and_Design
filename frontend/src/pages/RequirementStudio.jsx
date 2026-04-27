import { useState, useEffect } from 'react'
import { Search, Plus, Loader2 } from 'lucide-react'
import ProjectCard from '../components/ProjectCard'
import NewProjectModal from '../components/NewProjectModal'
import { fetchProjects, createProject, deleteProject } from '../api/projectsApi'

export default function RequirementStudio() {
  const [projects, setProjects] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      q
        ? projects.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.client_name?.toLowerCase().includes(q) ||
              p.description?.toLowerCase().includes(q)
          )
        : projects
    )
  }, [search, projects])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProjects()
      setProjects(data)
    } catch {
      setError('Failed to load projects. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(formData) {
    setCreating(true)
    try {
      const project = await createProject(formData)
      setProjects((prev) => [project, ...prev])
      setShowModal(false)
    } catch {
      alert('Failed to create project.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(projectId) {
    if (!confirm('Delete this project?')) return
    try {
      await deleteProject(projectId)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } catch {
      alert('Failed to delete project.')
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Requirements & Design Studio</h1>
        <p className="text-sm text-gray-500 mt-1">
          End-to-end AI-powered requirements engineering &amp; design across 16 modules and 16 service lines
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          New Project
        </button>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          <span className="text-sm">Loading projects...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">
            {search ? 'No projects match your search.' : 'No projects yet. Create your first one!'}
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          loading={creating}
        />
      )}
    </div>
  )
}