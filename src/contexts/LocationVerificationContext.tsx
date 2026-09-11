import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  type AllowedLocation,
  getAllowedLocations,
  addAllowedLocation as configAddLocation,
  updateAllowedLocation as configUpdateLocation,
  setLocationRadius as configSetRadius,
  evaluateUserLocation,
} from '@/config/locationConfig'
import {
  getCurrentBrowserPosition,
  queryGeolocationPermissionState,
  GeolocationError,
} from '@/services/locationService'

export type LocationVerificationStatus =
  | 'idle'
  | 'requesting_permission'
  | 'checking_location'
  | 'verified'
  | 'permission_denied'
  | 'location_unavailable'
  | 'outside_allowed_area'
  | 'error'

export interface LocationVerificationContextType {
  status: LocationVerificationStatus
  isVerified: boolean
  matchedLocation: AllowedLocation | null
  closestLocation: AllowedLocation | null
  distanceMeters: number | null
  allowedRadiusMeters: number | null
  accuracy: number | null
  errorMessage: string | null
  isBorderline: boolean
  allowedLocations: AllowedLocation[]
  checkLocation: () => Promise<boolean>
  retry: () => Promise<boolean>
  reset: () => void
  addCustomLocation: (location: AllowedLocation) => void
  updateLocation: (id: string, updates: Partial<AllowedLocation>) => void
  setLocationRadius: (id: string, radiusMeters: number) => void
}

const LocationVerificationContext = createContext<LocationVerificationContextType | null>(null)

interface LocationVerificationProviderProps {
  children: React.ReactNode
}

export function LocationVerificationProvider({ children }: LocationVerificationProviderProps) {
  const [status, setStatus] = useState<LocationVerificationStatus>('idle')
  const [matchedLocation, setMatchedLocation] = useState<AllowedLocation | null>(null)
  const [closestLocation, setClosestLocation] = useState<AllowedLocation | null>(null)
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isBorderline, setIsBorderline] = useState(false)
  const [locationsVersion, setLocationsVersion] = useState(0)

  // Primary verification runner
  const performLocationCheck = useCallback(async (): Promise<boolean> => {
    setStatus('checking_location')
    setErrorMessage(null)

    try {
      const position = await getCurrentBrowserPosition()
      const evaluation = evaluateUserLocation(
        position.latitude,
        position.longitude,
        position.accuracy
      )

      setDistanceMeters(evaluation.distanceMeters)
      setAllowedRadiusMeters(evaluation.allowedRadiusMeters)
      setAccuracy(evaluation.accuracyMeters)
      setClosestLocation(evaluation.closestLocation)
      setIsBorderline(evaluation.isBorderline)

      if (evaluation.isInside && evaluation.matchedLocation) {
        setMatchedLocation(evaluation.matchedLocation)
        setStatus('verified')
        return true
      } else {
        setMatchedLocation(null)
        setStatus('outside_allowed_area')
        return false
      }
    } catch (err: unknown) {
      setMatchedLocation(null)

      if (err instanceof GeolocationError) {
        setErrorMessage(err.message)
        if (err.code === 'PERMISSION_DENIED') {
          setStatus('permission_denied')
        } else if (err.code === 'POSITION_UNAVAILABLE' || err.code === 'TIMEOUT') {
          setStatus('location_unavailable')
        } else {
          setStatus('error')
        }
      } else {
        setErrorMessage('An unexpected error occurred while verifying your location.')
        setStatus('error')
      }
      return false
    }
  }, [])

  // Auto-check if permission is already granted in the browser
  useEffect(() => {
    let isMounted = true

    async function checkInitialPermission() {
      const permState = await queryGeolocationPermissionState()
      if (!isMounted) return

      if (permState === 'granted') {
        // Permission was already granted by customer previously; auto-verify immediately
        performLocationCheck()
      } else if (permState === 'denied') {
        setStatus('permission_denied')
        setErrorMessage(
          'Location permission is blocked in your browser settings. Please allow access to proceed.'
        )
      } else {
        // 'prompt' or 'unsupported': leave as 'idle' so user can tap "Allow Location Access"
        setStatus('idle')
      }
    }

    checkInitialPermission()

    return () => {
      isMounted = false
    }
  }, [performLocationCheck])

  // Explicit user action to request location
  const checkLocation = useCallback(async (): Promise<boolean> => {
    setStatus('requesting_permission')
    return performLocationCheck()
  }, [performLocationCheck])

  const retry = useCallback(async (): Promise<boolean> => {
    return checkLocation()
  }, [checkLocation])

  const reset = useCallback(() => {
    setStatus('idle')
    setMatchedLocation(null)
    setClosestLocation(null)
    setDistanceMeters(null)
    setAllowedRadiusMeters(null)
    setAccuracy(null)
    setErrorMessage(null)
    setIsBorderline(false)
  }, [])

  // Dynamic location management helpers
  const addCustomLocation = useCallback((loc: AllowedLocation) => {
    configAddLocation(loc)
    setLocationsVersion((v) => v + 1)
  }, [])

  const updateLocation = useCallback((id: string, updates: Partial<AllowedLocation>) => {
    configUpdateLocation(id, updates)
    setLocationsVersion((v) => v + 1)
  }, [])

  const setLocationRadius = useCallback((id: string, radiusMeters: number) => {
    configSetRadius(id, radiusMeters)
    setLocationsVersion((v) => v + 1)
  }, [])

  const currentAllowedLocations = React.useMemo(() => {
    return getAllowedLocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationsVersion])

  const value: LocationVerificationContextType = {
    status,
    isVerified: status === 'verified',
    matchedLocation,
    closestLocation,
    distanceMeters,
    allowedRadiusMeters,
    accuracy,
    errorMessage,
    isBorderline,
    allowedLocations: currentAllowedLocations,
    checkLocation,
    retry,
    reset,
    addCustomLocation,
    updateLocation,
    setLocationRadius,
  }

  return (
    <LocationVerificationContext.Provider value={value}>
      {children}
    </LocationVerificationContext.Provider>
  )
}

export function useLocationVerification(): LocationVerificationContextType {
  const context = useContext(LocationVerificationContext)
  if (!context) {
    throw new Error('useLocationVerification must be used within a LocationVerificationProvider')
  }
  return context
}
