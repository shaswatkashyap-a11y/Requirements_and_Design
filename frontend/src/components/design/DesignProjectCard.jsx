import { useNavigate } from 'react-router-dom'
import { Compass, ChevronRight } from 'lucide-react'

function ServiceLineTag({ code }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
      {code}
    </span>
  )
}

export default function DesignProjectCard({ project }) {
  const navigate = useNavigate()

  const serviceLines = project.service_line
    ? project.service_line.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const date = new Date(
    project.created_at && !project.created_at.endsWith('Z')
      ? project.created_at + 'Z'
      : project.created_at
  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <button
      onClick={() => navigate(`/design-studio/projects/${project.id}`)}
      className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group flex items-center gap-4 px-5 py-4"
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-100 transition-colors">
        <Compass size={20} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{project.name}</p>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200 flex-shrink-0">
            ACTIVE
          </span>
        </div>
        {project.client_name && (
          <p className="text-xs text-gray-400 mb-2 truncate">{project.client_name}</p>
        )}
        {serviceLines.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {serviceLines.slice(0, 5).map((sl) => (
              <ServiceLineTag key={sl} code={sl} />
            ))}
            {serviceLines.length > 5 && (
              <span className="text-[10px] text-gray-400 px-1">+{serviceLines.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      {/* Meta + Arrow */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <p className="text-[10px] text-gray-400">{date}</p>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
      </div>
    </button>
  )
}
