interface QuantityControlProps {
  quantity: number
  onIncrease: (e?: React.MouseEvent) => void
  onDecrease: (e?: React.MouseEvent) => void
  disabled?: boolean
  disableIncrease?: boolean
  disableDecrease?: boolean
  max?: number
}

export function QuantityControl({
  quantity,
  onIncrease,
  onDecrease,
  disabled = false,
  disableIncrease = false,
  disableDecrease = false,
  max,
}: QuantityControlProps) {
  const isIncreaseDisabled = disabled || disableIncrease || (max !== undefined && quantity >= max)
  const isDecreaseDisabled = disabled || disableDecrease

  return (
    <div className="flex items-center justify-between rounded-xl bg-[#F1F6F9] p-1 border border-[#9BA4B4]/25 shadow-2xs">
      <button
        onClick={onDecrease}
        disabled={isDecreaseDisabled}
        aria-label="Decrease quantity"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#9BA4B4]/30 bg-white text-base font-black text-[#14274E] shadow-2xs hover:bg-[#F1F6F9] active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer"
      >
        −
      </button>
      <span className="text-xs font-black text-[#14274E] tabular-nums min-w-[28px] text-center select-none">
        {quantity}
      </span>
      <button
        onClick={onIncrease}
        disabled={isIncreaseDisabled}
        aria-label="Increase quantity"
        title={isIncreaseDisabled && max !== undefined && quantity >= max ? `Maximum order stock reached (${max})` : undefined}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-white text-base font-black shadow-2xs transition-all duration-150 select-none ${
          isIncreaseDisabled
            ? 'bg-[#14274E]/30 opacity-40 cursor-not-allowed'
            : 'bg-[#14274E] hover:bg-[#14274E]/90 active:scale-90 cursor-pointer'
        }`}
      >
        +
      </button>
    </div>
  )
}
