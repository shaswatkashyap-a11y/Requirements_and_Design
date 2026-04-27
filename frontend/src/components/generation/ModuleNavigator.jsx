import { Layers, Package } from 'lucide-react'

export default function ModuleNavigator({ modules, selectedId, onSelect }) {
  const totalArtifacts = modules.reduce((acc, m) => acc + (m.artifact_count || 0), 0)

  return (
    <div className="flex flex-col h-full">
      {/* Summary stats */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-blue-600">{modules.length}</p>
            <p className="text-[10px] text-gray-500">Modules</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-indigo-600">{totalArtifacts}</p>
            <p className="text-[10px] text-gray-500">Artifacts</p>
          </div>
        </div>
      </div>

      {/* Module list */}
      <div className="overflow-y-auto flex-1">
        {modules.map((mod, idx) => {
          const isActive = mod.id === selectedId
          return (
            <button
              key={mod.id}
              onClick={() => onSelect(mod.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                isActive
                  ? 'bg-blue-50 border-l-2 border-l-blue-500'
                  : 'hover:bg-gray-50 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`mt-0.5 p-1 rounded flex-shrink-0 ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Package size={12} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-snug font-medium ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                    {mod.name}
                  </p>
                  {mod.description && (
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug line-clamp-2">
                      {mod.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0 rounded ${
                      isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {mod.artifact_count || 0} artifacts
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
