// ─── Native Geolocation Service ───────────────────────────────────────────────
//
// Interacts directly with the native browser Geolocation API (`navigator.geolocation`).
// Fails closed on any permission denial, position error, or timeout.

export interface GeolocationPositionResult {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export type GeolocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED'
  | 'INSECURE_CONTEXT'
  | 'UNKNOWN'

export class GeolocationError extends Error {
  code: GeolocationErrorCode
  originalError?: GeolocationPositionError

  constructor(message: string, code: GeolocationErrorCode, originalError?: GeolocationPositionError) {
    super(message)
    this.name = 'GeolocationError'
    this.code = code
    this.originalError = originalError
  }
}

/**
 * Standard geolocation request options as specified in prompt:
 * - enableHighAccuracy: true (utilizes GPS if on mobile)
 * - timeout: 10000 (10 seconds timeout)
 * - maximumAge: 0 (forces fresh reading, no old cache)
 */
const DEFAULT_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
}

/**
 * Checks whether the current browser environment supports Geolocation.
 */
export function isGeolocationSupported(): boolean {
  return typeof window !== 'undefined' && 'geolocation' in navigator
}

/**
 * Checks whether the current context is secure (HTTPS or localhost).
 */
export function isSecureContextEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  if (window.isSecureContext !== undefined) {
    return window.isSecureContext
  }
  const hostname = window.location.hostname
  return (
    window.location.protocol === 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local')
  )
}

/**
 * Queries the browser's current permission status if supported.
 * Returns 'granted' | 'denied' | 'prompt' | 'unsupported'.
 */
export async function queryGeolocationPermissionState(): Promise<
  PermissionState | 'unsupported'
> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.permissions ||
    typeof navigator.permissions.query !== 'function'
  ) {
    return 'unsupported'
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state
  } catch {
    return 'unsupported'
  }
}

/**
 * Obtains the current geographic position using navigator.geolocation.getCurrentPosition.
 *
 * @param customOptions Optional override for PositionOptions
 * @returns Promise resolving to GeolocationPositionResult
 * @throws GeolocationError on any failure (fail closed)
 */
export function getCurrentBrowserPosition(
  customOptions?: Partial<PositionOptions>
): Promise<GeolocationPositionResult> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      return reject(
        new GeolocationError(
          'Geolocation is not supported by your browser.',
          'NOT_SUPPORTED'
        )
      )
    }

    if (!isSecureContextEnvironment()) {
      return reject(
        new GeolocationError(
          'Geolocation requires a secure HTTPS connection.',
          'INSECURE_CONTEXT'
        )
      )
    }

    const options: PositionOptions = {
      ...DEFAULT_GEOLOCATION_OPTIONS,
      ...customOptions,
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        })
      },
      (error: GeolocationPositionError) => {
        let code: GeolocationErrorCode = 'UNKNOWN'
        let userMessage = 'Unable to determine your current location.'

        switch (error.code) {
          case error.PERMISSION_DENIED:
            code = 'PERMISSION_DENIED'
            userMessage =
              'Location permission was denied. Please allow location access in your browser settings to access the ordering interface.'
            break
          case error.POSITION_UNAVAILABLE:
            code = 'POSITION_UNAVAILABLE'
            userMessage =
              'Location information is unavailable. Please verify device GPS / location services are active.'
            break
          case error.TIMEOUT:
            code = 'TIMEOUT'
            userMessage =
              'Location request timed out. Please check your signal and tap Try Again.'
            break
          default:
            code = 'UNKNOWN'
            userMessage = error.message || 'An unexpected error occurred while verifying location.'
        }

        reject(new GeolocationError(userMessage, code, error))
      },
      options
    )
  })
}
