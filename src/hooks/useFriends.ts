"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { db, CachedFriend, setSyncTimestamp, getSyncTimestamp } from "@/lib/db"
import { useNetworkStatus } from "./useNetworkStatus"

export function useFriends(userId: string | null) {
  const [friends, setFriends] = useState<CachedFriend[]>([])
  const [loading, setLoading] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const networkStatus = useNetworkStatus()
  const lastFetchEpochRef = useRef<number>(0)

  const loadFromCache = useCallback(async () => {
    if (!userId) return

    try {
      const cached = await db.friends.toArray()
      if (cached.length > 0) {
        setFriends(cached)
      }

      const syncData = await getSyncTimestamp("friends")
      if (syncData) {
        setLastSyncedAt(new Date(syncData.last_sync_at))
      }
    } catch (err) {
      console.error("[useFriends] Cache load error:", err)
    }
  }, [userId])

  const syncFriends = useCallback(async () => {
    if (!userId || networkStatus === "offline") return

    setLoading(true)

    try {
      const response = await fetch(`/api/people-nearby?userId=${userId}&scope=friends`, {
        signal: AbortSignal.timeout(8000),
      })

      if (!response.ok) return

      const data = await response.json()
      const serverFriends = data.people || []

      const syncTimestamp = await getSyncTimestamp("friends")
      const currentEpoch = (syncTimestamp?.epoch || 0) + 1

      if (currentEpoch < lastFetchEpochRef.current) {
        console.warn("[useFriends] Stale response detected, ignoring")
        return
      }

      lastFetchEpochRef.current = currentEpoch

      await db.friends.clear()

      const friendsToCache: CachedFriend[] = serverFriends.map((friend: any) => ({
        id: friend.id,
        username: friend.username,
        display_name: friend.display_name,
        avatar_url: friend.avatar_url,
        is_online: friend.is_online ?? false,
        updated_at: Date.now(),
      }))

      if (friendsToCache.length > 0) {
        await db.friends.bulkPut(friendsToCache)
      }

      await setSyncTimestamp("friends", currentEpoch)

      setFriends(friendsToCache)
      setLastSyncedAt(new Date())
    } catch (err: any) {
      console.error("[useFriends] Sync error:", err)
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

    syncFriends()

    const handleFocus = () => {
      syncFriends()
    }

    const handleOnline = () => {
      syncFriends()
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("online", handleOnline)

    const interval = setInterval(syncFriends, 30000)

    return () => {
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("online", handleOnline)
      clearInterval(interval)
    }
  }, [userId, syncFriends])

  return {
    friends,
    loading,
    lastSyncedAt,
    refresh: syncFriends,
  }
}
