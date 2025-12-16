"use client"

import { useState, useEffect, useRef } from "react"
import { Capacitor } from "@capacitor/core"
import { Network } from "@capacitor/network"
import { getApiUrl } from "@/lib/api"

export type NetworkStatus = "online" | "offline" | "degraded"

const HEALTH_CHECK_INTERVAL = 30000
const HEALTH_CHECK_TIMEOUT = 5000
const LATENCY_THRESHOLD_MS = 2000

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>("online")
  const [connectionType, setConnectionType] = useState<string>("unknown")
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isNative = Capacitor.getPlatform() !== "web"

  useEffect(() => {
    const checkBackendHealth = async () => {
      if (isNative) {
        const netStatus = await Network.getStatus()
        if (!netStatus.connected) {
          setStatus("offline")
          return
        }
        setConnectionType(netStatus.connectionType)
      } else {
        if (!navigator.onLine) {
          setStatus("offline")
          return
        }
      }

      try {
        const controller = new AbortController()
        timeoutRef.current = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

        const startTime = Date.now()
        const response = await fetch(getApiUrl("/api/health"), {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        })
        const latency = Date.now() - startTime

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        if (response.ok) {
          if (latency > LATENCY_THRESHOLD_MS) {
            setStatus("degraded")
          } else {
            setStatus("online")
          }
        } else {
          setStatus("degraded")
        }
      } catch (error: any) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        if (error.name === "AbortError") {
          setStatus("degraded")
        } else {
          setStatus("offline")
        }
      }
    }

    const handleNetworkChange = async () => {
      if (isNative) {
        const netStatus = await Network.getStatus()
        if (netStatus.connected) {
          setConnectionType(netStatus.connectionType)
          checkBackendHealth()
        } else {
          setStatus("offline")
        }
      }
    }

    const handleOnline = () => {
      checkBackendHealth()
    }

    const handleOffline = () => {
      setStatus("offline")
    }

    if (isNative) {
      Network.addListener("networkStatusChange", handleNetworkChange)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    checkBackendHealth()

    healthCheckRef.current = setInterval(checkBackendHealth, HEALTH_CHECK_INTERVAL)

    return () => {
      if (isNative) {
        Network.removeAllListeners()
      }
      
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current)
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isNative])

  return { status, connectionType }
}
