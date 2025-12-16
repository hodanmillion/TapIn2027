const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tap-in2026-jj45.vercel.app'

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  
  // Detect local development environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    
    // Check if running on localhost or private network
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
    
    if (isLocalDev) {
      return cleanPath
    }
  }
  
  return `${API_BASE_URL}${cleanPath}`
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