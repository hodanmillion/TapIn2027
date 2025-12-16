"use client"

import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { WifiOff, CloudOff } from "lucide-react"

export function OfflineBanner() {
  const { status: networkStatus, connectionType } = useNetworkStatus()

  if (networkStatus === "online") return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] safe-top safe-horizontal ${
        networkStatus === "offline"
          ? "bg-rose-500/95"
          : "bg-amber-500/95"
      } text-white backdrop-blur-sm border-b border-white/20`}
    >
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2.5 text-sm font-medium">
        {networkStatus === "offline" ? (
          <>
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>No internet • Messages will sync when back online</span>
          </>
        ) : (
          <>
            <CloudOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
            <span>Slow connection{connectionType !== "unknown" ? ` (${connectionType})` : ""} • Showing cached data</span>
          </>
        )}
      </div>
    </div>
  )
}
