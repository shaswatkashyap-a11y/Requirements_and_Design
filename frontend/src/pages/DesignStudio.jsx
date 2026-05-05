import { useState, useEffect } from 'react'
import { Search, FolderOpen, Layers, LayoutGrid, Loader2, ChevronUp, ChevronDown } from 'lucide-react'
import { fetchProjects } from '../api/projectsApi'
import DesignProjectCard from '../components/design/DesignProjectCard'
import ServiceLineStandardCard from '../components/design/ServiceLineStandardCard'
import PlatformCombinationTable from '../components/design/PlatformCombinationTable'
import { SERVICE_LINE_STANDARDS, SERVICE_LINE_GROUPS } from '../data/serviceLineStandards'
import { PLATFORM_COMBINATIONS } from '../data/platformCombinations'

const TABS = [
  { id: 'projects',   label: 'Projects',                  icon: FolderOpen  },
  { id: 'm15',        label: 'Service Line Standards (M15)', icon: Layers    },
  { id: 'm16',        label: 'Platform Combinations (M16)', icon: LayoutGrid },
]

// ── Projects Tab ─────────────────────────────────────────────────────────────
function ProjectsTab() {
  const [projects, setProjects] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={22} className="animate-spin mr-2" />
        <span className="text-sm">Loading projects...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{error}</div>
    )
  }

  return (
    <div>
      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">{search ? 'No projects match your search.' : 'No projects yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map((project) => (
            <DesignProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── M15 Service Line Standards Tab ───────────────────────────────────────────
function ServiceLineStandardsTab() {
  const [search, setSearch] = useState('')

  const filtered = search
    ? SERVICE_LINE_STANDARDS.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.code.toLowerCase().includes(search.toLowerCase()) ||
          s.group.toLowerCase().includes(search.toLowerCase())
      )
    : SERVICE_LINE_STANDARDS

  const grouped = SERVICE_LINE_GROUPS.map((group) => ({
    ...group,
    standards: filtered.filter((s) => s.group === group.label),
  })).filter((g) => g.standards.length > 0)

  return (
    <div>
      <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-2xl">
        16 technology-specific design standards, NFR baselines, and best-practice patterns.
        Select a service line during project creation to auto-load its configuration into the HLD generator.
      </p>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search service lines..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
        />
      </div>

      <div className="space-y-8">
        {grouped.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${group.dot}`} />
              <h3 className={`text-xs font-bold tracking-wider uppercase ${group.color}`}>
                {group.label}
              </h3>
              <span className="text-[10px] text-gray-400">({group.standards.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {group.standards.map((s) => (
                <ServiceLineStandardCard key={s.code} standard={s} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── M16 Platform Combinations Tab ────────────────────────────────────────────
function PlatformCombinationsTab() {
  const [search, setSearch] = useState('')

  const filtered = search
    ? PLATFORM_COMBINATIONS.filter(
        (c) =>
          c.use_case.toLowerCase().includes(search.toLowerCase()) ||
          c.id.toLowerCase().includes(search.toLowerCase()) ||
          c.service_lines.some((sl) => sl.includes(search.toLowerCase()))
      )
    : PLATFORM_COMBINATIONS

  return (
    <div>
      <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-2xl">
        20 pre-configured platform combinations with cross-stack integration patterns.
        Click any row to see architecture style, integration patterns, and typical use cases.
      </p>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by service line or use case..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No combinations match your search.</p>
      ) : (
        <PlatformCombinationTable combinations={filtered} />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DesignStudio() {
  const [activeTab, setActiveTab] = useState('projects')

  const scrollUp = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const scrollDown = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Design Studio</h1>
          <p className="text-sm text-gray-500 mt-1">
            Architecture, API contracts, data models, wireframes, and service-line-specific design standards
          </p>
        </div>
        {/* Scroll arrows */}
        <div className="flex flex-col gap-1">
          <button
            onClick={scrollUp}
            className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={scrollDown}
            className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all ${
                active
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'projects' && <ProjectsTab />}
      {activeTab === 'm15'      && <ServiceLineStandardsTab />}
      {activeTab === 'm16'      && <PlatformCombinationsTab />}
    </div>
  )
}
