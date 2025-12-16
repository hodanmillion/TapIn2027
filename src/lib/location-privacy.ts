/**
 * Location Privacy Utilities
 * 
 * This module ensures GPS coordinates are never exposed to users or client-visible UI.
 * All location data is abstracted into safe, privacy-preserving representations.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

/**
 * Encode coordinates to geohash (precision 6 = ~610m, precision 7 = ~76m)
 * Used for location zones without exposing exact GPS coordinates
 */
export function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let latMin = -90, latMax = 90
  let lngMin = -180, lngMax = 180
  let hash = ''
  let even = true
  let bit = 0
  let ch = 0

  while (hash.length < precision) {
    const val = even ? lng : lat
    const min = even ? lngMin : latMin
    const max = even ? lngMax : latMax
    const mid = (min + max) / 2

    if (val >= mid) {
      ch |= (1 << (4 - bit))
      if (even) lngMin = mid; else latMin = mid
    } else {
      if (even) lngMax = mid; else latMax = mid
    }

    even = !even

    if (bit < 4) {
      bit++
    } else {
      hash += BASE32[ch]
      bit = 0
      ch = 0
    }
  }

  return hash
}

/**
 * Generate a safe location identifier (UUID-like)
 * Used for location chat IDs and zone references
 */
export function generateLocationId(lat: number, lng: number, radius: number = 50): string {
  // Round to zone boundaries (50m precision)
  const zoneLat = Math.round(lat * 1000) / 1000
  const zoneLng = Math.round(lng * 1000) / 1000
  const geohash = encodeGeohash(zoneLat, zoneLng, 7)
  
  // Create deterministic ID from geohash
  return `loc_${geohash}_${radius}m`
}

/**
 * Add randomized offset to coordinates for map display
 * Prevents exact position disclosure while maintaining relative positioning
 */
export function obfuscateCoordinates(lat: number, lng: number, maxOffsetMeters: number = 25): { lat: number; lng: number } {
  // Convert meters to degrees (approximate)
  const offsetLat = (Math.random() - 0.5) * (maxOffsetMeters / 111000)
  const offsetLng = (Math.random() - 0.5) * (maxOffsetMeters / (111000 * Math.cos(lat * Math.PI / 180)))
  
  return {
    lat: lat + offsetLat,
    lng: lng + offsetLng
  }
}

/**
 * Snap coordinates to zone center (coarse grid)
 * Used for "approximate location" display
 */
export function snapToZone(lat: number, lng: number, zoneSizeMeters: number = 250): { lat: number; lng: number } {
  // Convert zone size to degrees
  const zoneSizeLat = zoneSizeMeters / 111000
  const zoneSizeLng = zoneSizeMeters / (111000 * Math.cos(lat * Math.PI / 180))
  
  return {
    lat: Math.round(lat / zoneSizeLat) * zoneSizeLat,
    lng: Math.round(lng / zoneSizeLng) * zoneSizeLng
  }
}

/**
 * Get safe display label for a location
 * Never returns exact coordinates - uses names, zones, or coarse geohash
 */
export function getSafeLocationLabel(
  locationName?: string | null, 
  lat?: number, 
  lng?: number,
  fallback: string = 'Unknown Area'
): string {
  // Prefer human-readable names
  if (locationName && 
      locationName !== 'Unknown' && 
      locationName !== 'Locating...' &&
      !locationName.match(/^Location\s+[-+]?\d+\.?\d*\s*,\s*[-+]?\d+\.?\d*$/i)) {
    return locationName
  }
  
  // Use geohash as zone identifier (no coordinates)
  if (lat !== undefined && lng !== undefined) {
    const geohash = encodeGeohash(lat, lng, 6)
    return `Zone ${geohash.slice(0, 4).toUpperCase()}`
  }
  
  return fallback
}

/**
 * Get safe display text for radius/proximity
 * Shows abstract zones instead of exact distances
 */
export function getProximityLabel(distanceMeters: number): string {
  if (distanceMeters < 50) return 'Right here'
  if (distanceMeters < 250) return 'Very close'
  if (distanceMeters < 500) return 'Nearby'
  if (distanceMeters < 1000) return 'In the area'
  if (distanceMeters < 2000) return 'In the neighborhood'
  return 'In the city'
}

/**
 * Validate that a string does NOT contain coordinate-like patterns
 * Throws error if coordinates are detected
 */
export function assertNoCoordinates(text: string, context: string = 'output'): void {
  const coordPattern = /[-+]?\d{1,3}\.\d{4,}[,\s]+[-+]?\d{1,3}\.\d{4,}/g
  const matches = text.match(coordPattern)
  
  if (matches) {
    throw new Error(`[PRIVACY VIOLATION] Coordinates detected in ${context}: ${matches[0]}`)
  }
}

/**
 * Sanitize object to remove coordinate fields before logging/display
 */
export function sanitizeLocationData<T extends Record<string, any>>(obj: T): Partial<T> {
  const sanitized = { ...obj }
  const coordFields = ['latitude', 'longitude', 'lat', 'lng', 'coordinates']
  
  coordFields.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field]
    }
  })
  
  return sanitized
}

/**
 * Memory-only coordinate storage (never persisted)
 * Used internally for distance calculations, immediately discarded after use
 */
export class EphemeralLocation {
  private lat: number
  private lng: number
  private timestamp: number
  private static readonly TTL_MS = 60000 // 1 minute max lifetime
  
  constructor(lat: number, lng: number) {
    this.lat = lat
    this.lng = lng
    this.timestamp = Date.now()
  }
  
  getCoordinates(): { lat: number; lng: number } | null {
    if (Date.now() - this.timestamp > EphemeralLocation.TTL_MS) {
      return null // Expired
    }
    return { lat: this.lat, lng: this.lng }
  }
  
  getLocationId(): string {
    return generateLocationId(this.lat, this.lng)
  }
  
  getGeohash(precision: number = 6): string {
    return encodeGeohash(this.lat, this.lng, precision)
  }
  
  getZone(zoneSizeMeters: number = 250): { lat: number; lng: number } {
    return snapToZone(this.lat, this.lng, zoneSizeMeters)
  }
  
  getObfuscated(maxOffsetMeters: number = 25): { lat: number; lng: number } {
    return obfuscateCoordinates(this.lat, this.lng, maxOffsetMeters)
  }
  
  distanceTo(other: EphemeralLocation): number {
    const coords = this.getCoordinates()
    const otherCoords = other.getCoordinates()
    if (!coords || !otherCoords) return Infinity
    
    const R = 6371000
    const dLat = (otherCoords.lat - coords.lat) * Math.PI / 180
    const dLng = (otherCoords.lng - coords.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coords.lat * Math.PI / 180) * Math.cos(otherCoords.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }
}
