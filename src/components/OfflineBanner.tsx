"use client"

import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { WifiOff, Wifi } from "lucide-react"

export function OfflineBanner() {
  const networkStatus = useNetworkStatus()

  if (networkStatus === "online") return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] safe-top safe-horizontal ${
        networkStatus === "offline"
          ? "bg-rose-500/95 text-white"
          : "bg-amber-500/95 text-white"
      } backdrop-blur-sm`}
    >
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
        {networkStatus === "offline" ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Offline — Messages will send when reconnected</span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4" />
            <span>Slow connection — Some features may be limited</span>
          </>
        )}
      </div>
    </div>
  )
}
