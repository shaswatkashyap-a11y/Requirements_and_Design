import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Folder, Trash2, Upload, FileText, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { uploadSOW, parseSOW, fetchProjectLatestSOW } from '../api/projectsApi'

function Tag({ label }) {
  const upper = label?.toUpperCase() || ''
  const color =
    upper === 'ACTIVE'
      ? 'bg-blue-50 text-blue-600 border-blue-200'
      : upper === 'FIXED' || upper === 'T&M' || upper === 'OUTCOME'
      ? 'bg-orange-50 text-orange-600 border-orange-200'
      : 'bg-gray-50 text-gray-500 border-gray-200'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border tracking-wide ${color}`}>
      {upper}
    </span>
  )
}

export default function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [sow, setSow] = useState(null) // { id, filename, status }

  useEffect(() => {
    fetchProjectLatestSOW(project.id)
      .then((data) => { if (data) setSow(data) })
      .catch(() => {})
  }, [project.id])
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState(null)

  const date = new Date(project.created_at && !project.created_at.endsWith('Z') ? project.created_at + 'Z' : project.created_at).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  })

  const tags = [
    'ACTIVE',
    project.engagement_model,
    project.methodology,
  ].filter(Boolean)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const result = await uploadSOW(project.id, file)
      setSow(result)
    } catch (err) {
      setError('Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleParse = async () => {
    if (!sow) return
    setError(null)
    setParsing(true)
    try {
      const result = await parseSOW(project.id, sow.id)
      setSow((prev) => ({ ...prev, status: result.status }))
    } catch (err) {
      setError('Parse failed')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col shadow-sm hover:shadow-md transition-shadow">
      {/* Card body */}
      <div className="p-4 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="text-blue-500">
              <Folder size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{project.name}</p>
              {project.client_name && (
                <p className="text-[11px] text-gray-400">{project.client_name}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => onDelete(project.id)}
            className="text-red-300 hover:text-red-500 transition-colors p-0.5"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>

        {/* Footer */}
        <p className="text-[11px] text-gray-400">{date}</p>
      </div>

      {/* SOW Upload section */}
      <div className="border-t border-gray-100 px-4 py-3">
        {!sow ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileRef.current.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={13} />
                  Upload SOW
                </>
              )}
            </button>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-blue-400 flex-shrink-0" />
              <span className="text-[11px] text-gray-600 truncate flex-1">{sow.filename}</span>
              {sow.status === 'parsed' || sow.status === 'completed' ? (
                <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
              ) : sow.status === 'failed' ? (
                <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
              ) : null}
            </div>
            {sow.status === 'uploaded' && (
              <button
                onClick={handleParse}
                disabled={parsing}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {parsing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Parsing...
                  </>
                ) : (
                  'Parse SOW'
                )}
              </button>
            )}
            {(sow.status === 'parsed' || sow.status === 'completed') && (
              <button
                onClick={() => navigate(`/projects/${project.id}/sow/${sow.id}`)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <ExternalLink size={12} />
                View SOW
              </button>
            )}
            {sow.status === 'failed' && (
              <p className="text-[10px] text-red-500 text-center">Parse failed. Try again.</p>
            )}
          </div>
        )}
        {error && <p className="text-[10px] text-red-500 mt-1 text-center">{error}</p>}
      </div>
    </div>
  )
}