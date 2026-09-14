import React, { useState, useEffect } from 'react'
import { Sparkles, AlertCircle, X, Layout, UtensilsCrossed } from 'lucide-react'
import type { RestaurantEvent } from '@/types/event'
import { fetchAllLayoutPresets, type TableLayoutPreset } from '@/services/tableLayoutService'
import { fetchMenuPresets, type MenuPreset } from '@/services/menuService'

interface EventActivateModalProps {
  isOpen: boolean
  event: RestaurantEvent | null
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const EventActivateModal: React.FC<EventActivateModalProps> = ({
  isOpen,
  event,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const [layoutPresets, setLayoutPresets] = useState<TableLayoutPreset[]>([])
  const [menuPresets, setMenuPresets] = useState<MenuPreset[]>([])

  useEffect(() => {
    if (!isOpen) return
    fetchAllLayoutPresets().then(setLayoutPresets).catch(() => setLayoutPresets([]))
    fetchMenuPresets().then(setMenuPresets).catch(() => setMenuPresets([]))
  }, [isOpen])

  if (!isOpen || !event) return null

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={loading ? undefined : onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14274E]/10 text-[#14274E] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[#14274E]" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#14274E]">Activate Event</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Switch active POS configuration</p>
            </div>
          </div>

          <button
            disabled={loading}
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Reminder Box */}
        <div className="bg-amber-50/80 rounded-xl p-3.5 border border-amber-200 flex items-start gap-2.5 text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-900">
              Activating will switch current menu and table layout to the event's presets
            </p>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Are you sure you want to activate <span className="font-black text-[#14274E]">"{event.title}"</span>?
            </p>
          </div>
        </div>

        {/* Presets Summary */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <Layout className="w-3.5 h-3.5 text-indigo-600" /> Linked Table Layout:
            </span>
            <span className="font-bold text-[#14274E]">
              {event.presetId
                ? layoutPresets.find((p) => p.LAYOUT_PRESET_ID === event.presetId)?.PRESET_NAME ?? `Preset #${event.presetId}`
                : 'None (Keep Current)'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" /> Linked Menu Preset:
            </span>
            <span className="font-bold text-[#14274E]">
              {event.menuPresetId
                ? menuPresets.find((m) => m.PRESET_ID === event.menuPresetId)?.PRESET_NAME ?? `Preset #${event.menuPresetId}`
                : 'None (Keep Current)'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-black text-white bg-[#14274E] hover:bg-[#1a3468] transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Activating...</span>
              </>
            ) : (
              <span>Activate Event</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
