const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim()
const FALLBACK_API_BASE = 'https://tap-in2026-jj45-git-main-hodans-projects-65e91166.vercel.app'
const resolvedEnvBase = (RAW_API_BASE && RAW_API_BASE.length > 0 ? RAW_API_BASE : FALLBACK_API_BASE).replace(/\/+$/, '')
let loggedBase = false

function assertValidApiBase(base: string): string {
  const disallowed = /(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)/i
  if (!base) {
    throw new Error('[API_BASE] Missing NEXT_PUBLIC_API_URL. Set a production https URL.')
  }
  if (!base.startsWith('https://')) {
    const msg = `[API_BASE] Insecure API base detected (${base}). Use https in production.`
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg)
    }
    console.warn(msg)
  }
  if (disallowed.test(base)) {
    const msg = `[API_BASE] Localhost/loopback base not allowed in production (${base}).`
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg)
    }
    console.warn(msg)
  }
  return base
}

const API_BASE_URL = assertValidApiBase(resolvedEnvBase)

function logBaseResolution(reason: string, extra?: Record<string, unknown>) {
  if (loggedBase) return
  loggedBase = true
  console.info('[API_BASE] resolved', {
    env: RAW_API_BASE || 'unset',
    fallback: FALLBACK_API_BASE,
    selected: API_BASE_URL,
    reason,
    ...extra,
  })
}

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`

  if (typeof window === 'undefined') {
    return cleanPath
  }

  const { protocol, origin, host } = window.location
  const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.()) || protocol === 'capacitor:' || protocol === 'ionic:'

  const finalUrl = `${API_BASE_URL}${cleanPath}`
  logBaseResolution(isNative ? 'native' : 'web', { protocol, origin })
  console.log(`[getApiUrl] platform=${isNative ? 'native' : 'web'} apiOrigin=${API_BASE_URL} url=${finalUrl}`)
  return finalUrl
}

export async function apiRequest(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path)
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
}
