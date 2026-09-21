import React from 'react'
import {
  type TableLayoutPreset,
} from '@/services/tableLayoutService'
import {
  Layers,
  ShieldCheck,
  Star,
  Pencil,
  Trash2,
  Plus,
  Lock,
  Users,
} from 'lucide-react'

interface PresetsManagerViewProps {
  presets: TableLayoutPreset[]
  activePresetId: number | null
  isEventActive?: boolean
  activeEventTitle?: string
  onSelectPreset: (presetId: number) => void
  onSetDefaultPreset: (presetId: number) => void
  onRenamePreset: (presetId: number, currentName: string) => void
  onDeletePreset: (presetId: number) => void
  onOpenNewPresetModal: () => void
}

export const PresetsManagerView: React.FC<PresetsManagerViewProps> = ({
  presets,
  activePresetId,
  isEventActive = false,
  activeEventTitle,
  onSelectPreset,
  onSetDefaultPreset,
  onRenamePreset,
  onDeletePreset,
  onOpenNewPresetModal,
}) => {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-[#14274E]">Floor Plan Layout Presets</h2>
          <p className="text-xs font-semibold text-slate-500">
            Manage reusable dining layouts and protect the standard operational floor plan.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewPresetModal}
          disabled={isEventActive}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14274E] hover:bg-[#0f1f40] text-white text-xs font-black transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5 text-[#E9C46A]" />
          <span>New Preset</span>
        </button>
      </div>

      {isEventActive && (
        <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-800">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Layout changes and switching are locked while event &ldquo;{activeEventTitle}&rdquo; is active.
          </span>
        </div>
      )}

      {/* Preset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {presets.map((preset) => {
          const isActive = preset.LAYOUT_PRESET_ID === activePresetId
          const isDefault = Boolean(preset.IS_DEFAULT)
          const isProtected = Boolean(preset.IS_PROTECTED)

          return (
            <div
              key={preset.LAYOUT_PRESET_ID}
              className={`bg-white rounded-2xl border p-5 transition-all shadow-xs ${
                isActive
                  ? 'border-[#14274E] ring-2 ring-[#14274E]/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isActive
                        ? 'bg-[#14274E] text-[#E9C46A] border-[#14274E]'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#14274E] flex items-center gap-1.5">
                      <span>{preset.PRESET_NAME}</span>
                      {isProtected && (
                        <span title="Protected Default Layout">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Grid: {preset.PRESET_GRID_WIDTH}x{preset.PRESET_GRID_HEIGHT} Units
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                      <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                      Default
                    </span>
                  )}
                  {isProtected && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Protected
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between py-3 border-y border-slate-100 text-xs my-3">
                <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Max Capacity: {preset.MAX_PAX ?? 50} Pax</span>
                </div>
                <div>
                  {isActive ? (
                    <span className="text-[11px] font-black text-[#14274E] bg-slate-100 px-2 py-0.5 rounded-md">
                      Currently Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectPreset(preset.LAYOUT_PRESET_ID)}
                      disabled={isEventActive}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer disabled:opacity-40"
                    >
                      Load Layout →
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => onSetDefaultPreset(preset.LAYOUT_PRESET_ID)}
                      className="text-[11px] font-bold text-slate-500 hover:text-[#14274E] transition-colors cursor-pointer"
                    >
                      Set as Default
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onRenamePreset(preset.LAYOUT_PRESET_ID, preset.PRESET_NAME)
                    }
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Rename preset"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {!isProtected && (
                    <button
                      type="button"
                      onClick={() => onDeletePreset(preset.LAYOUT_PRESET_ID)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete preset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
