// ─── Location & Geofence Configuration ──────────────────────────────────────────
//
// Modular location and radius configuration for customer interface access verification.
//
// Features:
// 1. Modular Allowed Locations: Easily add new campuses, branches, outdoor venues.
// 2. Modular Radius: Each location defines its own allowed radius (Default: 2000m / 2km).
// 3. Geodesic Haversine calculation: High-precision circular proximity verification.
// 4. Extensible Registry: Programmatic helpers to add/remove/update locations at runtime.

export interface AllowedLocation {
  id: string
  name: string
  address?: string
  latitude: number
  longitude: number
  /**
   * Allowed geofence radius in meters.
   * Default: 2,000 meters (2km).
   */
  radiusMeters: number
  enabled: boolean
  description?: string
}

/**
 * Default geofence radius: 150 meters.
 * Can be overridden per location or via VITE_LOCATION_CHECK_RADIUS_METERS env.
 */
export const DEFAULT_RADIUS_METERS = Number(import.meta.env.VITE_LOCATION_CHECK_RADIUS_METERS) || 150

/**
 * Primary reference coordinates for Siena College of Taytay.
 * Can be overridden via environment variables if needed.
 */
export const SIENA_COLLEGE_COORDINATES = {
  latitude: Number(import.meta.env.VITE_LOCATION_CHECK_CENTER_LAT) || 14.568434,
  longitude: Number(import.meta.env.VITE_LOCATION_CHECK_CENTER_LNG) || 121.135246,
}

/**
 * Default allowed locations list.
 * Siena College of Taytay is configured as the primary active venue.
 * Developers and administrators can add additional branches/locations to this list or at runtime.
 */
export const INITIAL_ALLOWED_LOCATIONS: AllowedLocation[] = [
  {
    id: 'siena-college-taytay',
    name: 'Siena College of Taytay',
    address: 'E. Rodriguez Ave, Taytay, 1920 Rizal, Philippines',
    latitude: SIENA_COLLEGE_COORDINATES.latitude,
    longitude: SIENA_COLLEGE_COORDINATES.longitude,
    radiusMeters: DEFAULT_RADIUS_METERS,
    enabled: true,
    description: 'Main Campus & Bill Shaw Restaurant Dining Vicinity',
  },
  // Example for adding future locations or branches:
  // {
  //   id: 'bill-shaw-annex',
  //   name: 'Bill Shaw Annex Venue',
  //   latitude: 14.569000,
  //   longitude: 121.136000,
  //   radiusMeters: 1000,
  //   enabled: false,
  //   description: 'Secondary Event Grounds',
  // },
]

/**
 * In-memory active locations registry.
 * Initialized with INITIAL_ALLOWED_LOCATIONS.
 */
let activeLocations: AllowedLocation[] = [...INITIAL_ALLOWED_LOCATIONS]

/**
 * Get all configured allowed locations.
 */
export function getAllowedLocations(): AllowedLocation[] {
  return [...activeLocations]
}

/**
 * Get only active/enabled allowed locations.
 */
export function getActiveAllowedLocations(): AllowedLocation[] {
  return activeLocations.filter((loc) => loc.enabled)
}

/**
 * Add a new location to the allowed list modularly.
 *
 * Example:
 * ```ts
 * addAllowedLocation({
 *   id: 'branch-2',
 *   name: 'Monolith Branch 2',
 *   latitude: 14.5500,
 *   longitude: 121.1200,
 *   radiusMeters: 2000,
 *   enabled: true
 * })
 * ```
 */
export function addAllowedLocation(location: AllowedLocation): void {
  const existingIdx = activeLocations.findIndex((l) => l.id === location.id)
  if (existingIdx >= 0) {
    activeLocations[existingIdx] = { ...location }
  } else {
    activeLocations.push({ ...location })
  }
}

/**
 * Remove an allowed location by its ID.
 */
export function removeAllowedLocation(id: string): void {
  activeLocations = activeLocations.filter((l) => l.id !== id)
}

/**
 * Update an existing allowed location's fields (e.g. radius, coordinates, enabled state).
 */
export function updateAllowedLocation(id: string, updates: Partial<AllowedLocation>): void {
  const loc = activeLocations.find((l) => l.id === id)
  if (loc) {
    Object.assign(loc, updates)
  }
}

/**
 * Set the allowed radius for a specific location in meters.
 */
export function setLocationRadius(id: string, radiusMeters: number): void {
  updateAllowedLocation(id, { radiusMeters })
}

/**
 * Reset allowed locations to initial defaults.
 */
export function resetAllowedLocations(): void {
  activeLocations = [...INITIAL_ALLOWED_LOCATIONS]
}

// ─── Geodesic Distance Calculations (Haversine Formula) ───────────────────────

/**
 * Calculates the great-circle distance between two points on the Earth
 * using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Geodesic distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth's mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Human-readable distance formatter.
 * Returns e.g. "350 m" or "1.8 km".
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

// ─── Evaluation Result Types ──────────────────────────────────────────────────

export interface LocationEvaluation {
  /** True if the user is inside the radius of ANY enabled allowed location */
  isInside: boolean
  /** The specific location that matched if isInside is true */
  matchedLocation: AllowedLocation | null
  /** The closest allowed location to the user */
  closestLocation: AllowedLocation | null
  /** Distance to the closest location in meters */
  distanceToClosestMeters: number
  /** Distance to the matched location if inside, else closest location */
  distanceMeters: number
  /** The radius of the closest or matched location */
  allowedRadiusMeters: number
  /** Accuracy of the GPS reading in meters */
  accuracyMeters: number | null
  /** True if user is outside but GPS accuracy margin might overlap the boundary */
  isBorderline: boolean
}

/**
 * Evaluates user coordinates against all enabled allowed locations.
 *
 * @param userLat Current user latitude
 * @param userLng Current user longitude
 * @param accuracyMeters Reported browser accuracy (optional)
 * @returns LocationEvaluation with verification verdict and distances
 */
export function evaluateUserLocation(
  userLat: number,
  userLng: number,
  accuracyMeters?: number
): LocationEvaluation {
  const enabledLocations = getActiveAllowedLocations()

  if (enabledLocations.length === 0) {
    return {
      isInside: false,
      matchedLocation: null,
      closestLocation: null,
      distanceToClosestMeters: 0,
      distanceMeters: 0,
      allowedRadiusMeters: DEFAULT_RADIUS_METERS,
      accuracyMeters: accuracyMeters ?? null,
      isBorderline: false,
    }
  }

  let closestLocation: AllowedLocation = enabledLocations[0]
  let minDistance = Infinity
  let matchedLocation: AllowedLocation | null = null

  for (const loc of enabledLocations) {
    const dist = calculateHaversineDistance(userLat, userLng, loc.latitude, loc.longitude)

    if (dist < minDistance) {
      minDistance = dist
      closestLocation = loc
    }

    // Check if inside this location's allowed radius
    if (dist <= loc.radiusMeters) {
      matchedLocation = loc
    }
  }

  const isInside = matchedLocation !== null
  const targetLocation = matchedLocation ?? closestLocation
  const targetDistance = isInside
    ? calculateHaversineDistance(
      userLat,
      userLng,
      matchedLocation!.latitude,
      matchedLocation!.longitude
    )
    : minDistance

  // Borderline calculation: user is slightly outside the radius, but accuracy circle overlaps
  const acc = accuracyMeters ?? 0
  const isBorderline = !isInside && minDistance - acc <= closestLocation.radiusMeters && acc > 50

  return {
    isInside,
    matchedLocation,
    closestLocation,
    distanceToClosestMeters: minDistance,
    distanceMeters: targetDistance,
    allowedRadiusMeters: targetLocation.radiusMeters,
    accuracyMeters: accuracyMeters ?? null,
    isBorderline,
  }
}
