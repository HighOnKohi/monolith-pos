import type { OrderStatus } from '@/types/order'
import { CheckCircle2, ChefHat, Utensils, UtensilsCrossed } from 'lucide-react'

interface OrderStatusTrackerProps {
  status: OrderStatus
}

export function OrderStatusTracker({ status }: OrderStatusTrackerProps) {
  // Ordered steps for customer progress
  const steps = [
    { key: 'VERIFIED', label: 'Confirmed', icon: CheckCircle2 },
    { key: 'PREPARING', label: 'Preparing', icon: ChefHat },
    { key: 'READY', label: 'Ready', icon: Utensils },
    { key: 'SERVED', label: 'Served', icon: UtensilsCrossed },
  ]

  // Find current step index (REQUESTED maps to index 0/Confirmed for UI simplicity if not verified yet)
  let currentIndex = steps.findIndex((s) => s.key === status)
  if (status === 'REQUESTED') currentIndex = 0
  if (currentIndex === -1) currentIndex = 0

  return (
    <div className="bg-white rounded-2xl border border-[#9BA4B4]/20 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[#14274E] mb-5">Order Progress</h3>
      
      <div className="relative flex justify-between">
        {/* Progress Line */}
        <div className="absolute top-5 left-[10%] right-[10%] h-1 bg-[#F1F6F9] -z-10 rounded-full" />
        <div 
          className="absolute top-5 left-[10%] h-1 bg-[#14274E] -z-10 rounded-full transition-all duration-500"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 80}%` }}
        />

        {steps.map((step, idx) => {
          const isActive = idx === currentIndex
          const isCompleted = idx < currentIndex
          const Icon = step.icon

          return (
            <div key={step.key} className="flex flex-col items-center gap-2 relative">
              <div
                className={[
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                  isActive ? 'bg-[#14274E] text-white shadow-md scale-110' : 
                  isCompleted ? 'bg-[#14274E] text-white' : 
                  'bg-[#F1F6F9] text-[#9BA4B4] border-2 border-white'
                ].join(' ')}
              >
                <Icon className={isActive ? 'w-5 h-5' : 'w-4 h-4'} />
              </div>
              <span 
                className={[
                  'text-xs font-bold transition-colors',
                  isActive ? 'text-[#14274E]' : isCompleted ? 'text-[#394867]' : 'text-[#9BA4B4]'
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
