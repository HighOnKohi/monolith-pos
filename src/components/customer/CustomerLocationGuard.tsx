import React from 'react'
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
  const { isVerified } = useLocationVerification()

  if (!isVerified) {
    return <LocationGate />
  }

  return <>{children}</>
}
