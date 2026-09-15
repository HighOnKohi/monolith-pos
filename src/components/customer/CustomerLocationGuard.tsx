import React from 'react'
import { Bug } from 'lucide-react'
import { useLocationVerification } from '@/contexts/LocationVerificationContext'
import { LocationGate } from './LocationGate'

interface CustomerLocationGuardProps {
  children: React.ReactNode
}

/**
 * Defensive Access Guard for customer-facing interfaces.
 *
 * Guarantees that children (customer ordering UI, menu, cart, assistance, checkout)
 * are NEVER mounted or rendered until the customer's native browser location has been
 * successfully verified within the permitted radius of Siena College of Taytay (or
 * configured venue).
 */
export function CustomerLocationGuard({ children }: CustomerLocationGuardProps) {
  const { isVerified, debugBypass, toggleDebugBypass } = useLocationVerification()

  if (!isVerified) {
    return <LocationGate />
  }

  return (
    <>
      {debugBypass && (
        <div className="fixed bottom-3 left-3 z-50 pointer-events-auto">
          <button
            onClick={toggleDebugBypass}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg border border-amber-400 cursor-pointer active:scale-95 transition-all opacity-85 hover:opacity-100"
            title="Location is currently BYPASSED in debug mode. Click to exit debug mode and re-enable location gate."
          >
            <Bug className="w-3 h-3" />
            <span>Bypass Active (Tap to Lock)</span>
          </button>
        </div>
      )}
      {children}
    </>
  )
}
