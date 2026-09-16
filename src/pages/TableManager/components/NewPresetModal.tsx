import React, { useState } from 'react'
import { X, Layers } from 'lucide-react'

interface NewPresetModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, maxPax: number, isDefault: boolean) => Promise<void>
}

export const NewPresetModal: React.FC<NewPresetModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('')
  const [maxPax, setMaxPax] = useState('50')
  const [isDefault, setIsDefault] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a preset name')
      return
    }

    const parsedPax = parseInt(maxPax, 10)
    if (isNaN(parsedPax) || parsedPax <= 0) {
      setError('Maximum Pax must be a positive number greater than 0')
      return
    }

    if (parsedPax > 200) {
      setError('Maximum Pax cannot exceed 200 seats')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await onCreate(name.trim(), parsedPax, isDefault)
      setName('')
      setMaxPax('50')
      setIsDefault(false)
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to create preset')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#14274E] text-[#E9C46A]">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-[#14274E]">
              Create New Layout Preset
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Preset Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend Dining Layout, Event Setup"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#14274E]/20 focus:bg-white transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Maximum Pax (Seating Capacity)
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={maxPax}
              onChange={(e) => setMaxPax(e.target.value)}
              placeholder="e.g. 50"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#14274E]/20 focus:bg-white transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Tables will be automatically distributed to match this capacity.
            </p>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-[#14274E] focus:ring-[#14274E] border-slate-300"
              />
              <span className="text-xs font-bold text-slate-700">
                Set as Default Floor Plan Preset
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-black text-white bg-[#14274E] hover:bg-[#0f1f40] rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Preset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

