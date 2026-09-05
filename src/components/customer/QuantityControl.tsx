interface QuantityControlProps {
  quantity: number
  onIncrease: () => void
  onDecrease: () => void
  disabled?: boolean
}

export function QuantityControl({ quantity, onIncrease, onDecrease, disabled = false }: QuantityControlProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#F1F6F9] p-1 border border-[#9BA4B4]/25 shadow-2xs">
      <button
        onClick={onDecrease}
        disabled={disabled}
        aria-label="Decrease quantity"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#9BA4B4]/30 bg-white text-base font-black text-[#14274E] shadow-2xs hover:bg-[#F1F6F9] active:scale-90 transition-all duration-150 disabled:opacity-40 select-none cursor-pointer"
      >
        −
      </button>
      <span className="text-xs font-black text-[#14274E] tabular-nums min-w-[28px] text-center select-none">
        {quantity}
      </span>
      <button
        onClick={onIncrease}
        disabled={disabled}
        aria-label="Increase quantity"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#14274E] text-white text-base font-black shadow-2xs hover:bg-[#14274E]/90 active:scale-90 transition-all duration-150 disabled:opacity-40 select-none cursor-pointer"
      >
        +
      </button>
    </div>
  )
}
