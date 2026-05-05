import { useState, useEffect } from 'react'
import { Search, FolderOpen, Loader2 } from 'lucide-react'
import { fetchProjects } from '../api/projectsApi'
import LLDProjectCard from '../components/design/LLDProjectCard'

export default function LLDStudio() {
  const [projects, setProjects] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    fetchProjects()
      .then((data) => { setProjects(data); setFiltered(data) })
      .catch(() => setError('Failed to load projects.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      q
        ? projects.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.client_name?.toLowerCase().includes(q) ||
              p.service_line?.toLowerCase().includes(q)
          )
        : projects
    )
  }, [search, projects])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <FolderOpen size={18} className="text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">LLD Studio</h1>
            <p className="text-xs text-gray-400">Generate detailed low-level designs grounded in your HLD and requirements</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" />
          <span className="text-sm">Loading projects...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">{search ? 'No projects match your search.' : 'No projects yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map((project) => (
            <LLDProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
