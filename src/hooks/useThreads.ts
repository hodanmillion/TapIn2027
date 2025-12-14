"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { db, CachedThread, setSyncTimestamp, getSyncTimestamp } from "@/lib/db"
import { useNetworkStatus } from "./useNetworkStatus"

export function useThreads(userId: string | null) {
  const [threads, setThreads] = useState<CachedThread[]>([])
  const [loading, setLoading] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const networkStatus = useNetworkStatus()
  const lastFetchEpochRef = useRef<number>(0)

  const loadFromCache = useCallback(async () => {
    if (!userId) return

    try {
      const cached = await db.threads
        .orderBy("last_message_at")
        .reverse()
        .toArray()

      if (cached.length > 0) {
        setThreads(cached)
      }

      const syncData = await getSyncTimestamp("threads")
      if (syncData) {
        setLastSyncedAt(new Date(syncData.last_sync_at))
      }
    } catch (err) {
      console.error("[useThreads] Cache load error:", err)
    }
  }, [userId])

  const syncThreads = useCallback(async () => {
    if (!userId || networkStatus === "offline") return

    setLoading(true)

    try {
      const [privateChatsRes, historyRes] = await Promise.allSettled([
        fetch(`/api/chat?userId=${userId}`, {
          signal: AbortSignal.timeout(8000),
        }),
        fetch(`/api/chat-history?userId=${userId}`, {
          signal: AbortSignal.timeout(8000),
        }),
      ])

      const syncTimestamp = await getSyncTimestamp("threads")
      const currentEpoch = (syncTimestamp?.epoch || 0) + 1

      if (currentEpoch < lastFetchEpochRef.current) {
        console.warn("[useThreads] Stale response detected, ignoring")
        return
      }

      lastFetchEpochRef.current = currentEpoch

      const threadsToCache: CachedThread[] = []

      if (privateChatsRes.status === "fulfilled" && privateChatsRes.value.ok) {
        const privateData = await privateChatsRes.value.json()
        const privateChats = privateData.chats || []

        privateChats.forEach((chat: any) => {
          threadsToCache.push({
            id: chat.id,
            type: "private",
            participant_ids: [chat.user1_id, chat.user2_id],
            last_message_at: chat.last_message_at || chat.created_at,
            last_message_preview: chat.last_message?.content,
            last_message_sender_id: chat.last_message?.sender_id,
            last_message_image_url: chat.last_message?.image_url,
            updated_at: Date.now(),
          })
        })
      }

      if (historyRes.status === "fulfilled" && historyRes.value.ok) {
        const historyData = await historyRes.value.json()
        const history = historyData.history || []

        history.forEach((visit: any) => {
          if (visit.chat) {
            threadsToCache.push({
              id: visit.chat.id,
              type: "location",
              location_name: visit.chat.location_name,
              latitude: visit.chat.latitude,
              longitude: visit.chat.longitude,
              last_message_at: visit.visited_at,
              updated_at: Date.now(),
            })
          }
        })
      }

      await db.threads.clear()

      if (threadsToCache.length > 0) {
        await db.threads.bulkPut(threadsToCache)
      }

      await setSyncTimestamp("threads", currentEpoch)

      setThreads(threadsToCache)
      setLastSyncedAt(new Date())
    } catch (err: any) {
      console.error("[useThreads] Sync error:", err)
    } finally {
      setLoading(false)
    }
  }, [userId, networkStatus])

  useEffect(() => {
    if (!userId) return

    loadFromCache()
  }, [userId, loadFromCache])

  useEffect(() => {
    if (!userId) return

    syncThreads()

    const handleFocus = () => {
      syncThreads()
    }

    const handleOnline = () => {
      syncThreads()
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("online", handleOnline)

    const interval = setInterval(syncThreads, 30000)

    return () => {
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("online", handleOnline)
      clearInterval(interval)
    }
  }, [userId, syncThreads])

  return {
    threads,
    loading,
    lastSyncedAt,
    refresh: syncThreads,
  }
}