"use client"

import { useState, useEffect, useRef } from "react"
import { getApiUrl } from "@/lib/api"

export type NetworkStatus = "online" | "offline" | "degraded"

const HEALTH_CHECK_INTERVAL = 30000 // 30s
const HEALTH_CHECK_TIMEOUT = 5000 // 5s

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>("online")
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkBackendHealth = async () => {
      if (!navigator.onLine) {
        setStatus("offline")
        return
      }

      try {
        const controller = new AbortController()
        timeoutRef.current = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

        const response = await fetch(getApiUrl("/api/health"), {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        })

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        if (response.ok) {
          setStatus("online")
        } else {
          setStatus("degraded")
        }
      } catch (error: any) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        if (error.name === "AbortError" || !navigator.onLine) {
          setStatus("degraded")
        } else {
          setStatus("degraded")
        }
      }
    }

    const handleOnline = () => {
      checkBackendHealth()
    }

    const handleOffline = () => {
      setStatus("offline")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    checkBackendHealth()

    healthCheckRef.current = setInterval(checkBackendHealth, HEALTH_CHECK_INTERVAL)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current)
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return status
}