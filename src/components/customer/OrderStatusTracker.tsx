import type { OrderStatus } from '@/types/order'
import { CheckCircle2, ChefHat, Clock, Flame, UtensilsCrossed } from 'lucide-react'

interface OrderStatusTrackerProps {
  status: OrderStatus
}

export function OrderStatusTracker({ status }: OrderStatusTrackerProps) {
  // 5 comprehensive stages for the real restaurant lifecycle
  const steps = [
    { key: 'REQUESTED', label: 'Received', icon: Clock, desc: 'Kitchen reviewing ingredients & stock' },
    { key: 'VERIFIED', label: 'Confirmed', icon: CheckCircle2, desc: 'Order verified by kitchen staff' },
    { key: 'PREPARING', label: 'Cooking', icon: ChefHat, desc: 'Chefs actively preparing your dishes' },
    { key: 'READY', label: 'Ready', icon: Flame, desc: 'Freshly cooked & ready for service' },
    { key: 'SERVED', label: 'Served', icon: UtensilsCrossed, desc: 'Delivered to your table. Enjoy!' },
  ]

  let currentIndex = steps.findIndex((s) => s.key === status)
  if (currentIndex === -1) currentIndex = 0
  const currentStep = steps[currentIndex]

  return (
    <div className="bg-white rounded-2xl border border-[#9BA4B4]/20 p-5 shadow-sm interactive-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-extrabold text-[#14274E]">Order Progress</h3>
          <p className="text-xs text-[#394867] font-medium mt-0.5">
            {currentStep.desc}
          </p>
        </div>
        <span className={[
          'text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider animate-fade-in',
          status === 'REQUESTED' ? 'bg-amber-100 text-amber-800' :
          status === 'VERIFIED' ? 'bg-blue-100 text-blue-800' :
          status === 'PREPARING' ? 'bg-orange-100 text-orange-800' :
          status === 'READY' ? 'bg-indigo-100 text-indigo-800' :
          'bg-emerald-100 text-emerald-800'
        ].join(' ')}>
          {status}
        </span>
      </div>
      
      <div className="relative flex justify-between pt-2 pb-1">
        {/* Progress Background Line */}
        <div className="absolute top-7 left-[8%] right-[8%] h-1 bg-[#F1F6F9] -z-10 rounded-full" />
        {/* Animated Active Progress Line */}
        <div 
          className="absolute top-7 left-[8%] h-1 bg-[#14274E] -z-10 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 84}%` }}
        />

        {steps.map((step, idx) => {
          const isActive = idx === currentIndex
          const isCompleted = idx < currentIndex
          const Icon = step.icon

          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5 relative select-none">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 relative',
                  isActive 
                    ? 'bg-[#14274E] text-[#E9C46A] shadow-md shadow-[#14274E]/30 scale-110 ring-4 ring-[#14274E]/15' : 
                  isCompleted 
                    ? 'bg-[#14274E] text-white shadow-xs' : 
                    'bg-[#F1F6F9] text-[#9BA4B4] border-2 border-white'
                ].join(' ')}
              >
                <Icon className={isActive ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                {isActive && (
                  <span className="absolute -inset-1 rounded-full border-2 border-[#E9C46A] animate-ping opacity-35 pointer-events-none" />
                )}
              </div>
              <span 
                className={[
                  'text-[10px] tracking-tight transition-colors',
                  isActive ? 'font-black text-[#14274E] scale-105' : 
                  isCompleted ? 'font-bold text-[#394867]' : 
                  'font-medium text-[#9BA4B4]'
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
