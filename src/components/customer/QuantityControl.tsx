interface QuantityControlProps {
  quantity: number
  onIncrease: () => void
  onDecrease: () => void
  disabled?: boolean
}

export function QuantityControl({ quantity, onIncrease, onDecrease, disabled = false }: QuantityControlProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#F1F6F9] p-1 border border-[#9BA4B4]/20">
      <button
        onClick={onDecrease}
        disabled={disabled}
        aria-label="Decrease quantity"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#9BA4B4]/30 bg-white text-lg font-bold text-[#14274E] shadow-xs active:scale-90 transition-transform disabled:opacity-40"
      >
        −
      </button>
      <span className="text-sm font-bold text-[#14274E] tabular-nums min-w-[28px] text-center">
        {quantity}
      </span>
      <button
        onClick={onIncrease}
        disabled={disabled}
        aria-label="Increase quantity"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14274E] text-white text-lg active:scale-90 transition-transform disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}
