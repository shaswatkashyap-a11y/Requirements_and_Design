import { useState } from 'react'
import { Check, X } from 'lucide-react'

export default function InlineEditor({ initialValue, onSave, onCancel }) {
  const [value, setValue] = useState(initialValue)

  return (
    <div className="mt-2">
      <textarea
        className="w-full text-xs font-mono border border-indigo-300 rounded p-2
                   focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y min-h-32"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2 mt-1 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50"
        >
          <X size={11} /> Cancel
        </button>
        <button
          onClick={() => onSave(value)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          <Check size={11} /> Save
        </button>
      </div>
    </div>
  )
}
