const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tap-in2026-jj45.vercel.app'

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    console.log(`[getApiUrl] Already full URL:`, path)
    return path
  }
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  
  // Detect runtime environment (web vs Capacitor native)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const isCapacitorNative = window.location.protocol === 'capacitor:' || Boolean((window as any).Capacitor?.isNativePlatform?.())
    const currentOrigin = `${window.location.protocol}//${window.location.host}`
    let apiOrigin = API_BASE_URL

    // If API_BASE_URL is set to a different host than the current web host,
    // prefer the current origin on web to avoid CORS issues. Native will still
    // use the absolute API_BASE_URL.
    try {
      const apiHost = new URL(API_BASE_URL).host
      if (apiHost !== window.location.host) {
        apiOrigin = currentOrigin
      }
    } catch {
      apiOrigin = currentOrigin
    }
    
    // Check if running on localhost or private network (web dev)
    const isLocalDev = 
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local') ||
      // 127.x.x.x range
      /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      // 192.168.x.x range
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      // 10.x.x.x range
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      // 172.16.x.x - 172.31.x.x range
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)

    const base = isCapacitorNative ? API_BASE_URL : apiOrigin
    const finalUrl = isLocalDev ? cleanPath : `${base}${cleanPath}`

    console.log(`[getApiUrl] hostname:${hostname} protocol:${window.location.protocol} isCapacitorNative:${isCapacitorNative} isLocalDev:${isLocalDev} apiOrigin:${base} path:${cleanPath} => ${finalUrl}`)
    return finalUrl
  }
  
  const finalUrl = `${API_BASE_URL}${cleanPath}`
  console.log(`[getApiUrl] [SSR] path:${cleanPath} => ${finalUrl}`)
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
