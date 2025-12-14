"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { db, CachedMessage, setSyncTimestamp, getSyncTimestamp } from "@/lib/db"
import { addMessageToOutbox, retryFailedMessage } from "@/lib/sync"
import { useNetworkStatus } from "./useNetworkStatus"
import { createClient } from "@/lib/supabase/client"
import type { LocationMessageWithUser } from "@/lib/types"

export function useMessages(threadId: string | null, userId: string | null, userLocation?: { lat: number; lng: number }) {
  const [messages, setMessages] = useState<(CachedMessage & { user?: any })[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const networkStatus = useNetworkStatus()
  const supabase = useRef(createClient()).current
  const lastFetchEpochRef = useRef<number>(0)

  const loadFromCache = useCallback(async () => {
    if (!threadId) return

    try {
      const cached = await db.messages
        .where("thread_id")
        .equals(threadId)
        .sortBy("created_at")

      if (cached.length > 0) {
        setMessages(cached)
      }
    } catch (err) {
      console.error("[useMessages] Cache load error:", err)
    }
  }, [threadId])

  const syncFromServer = useCallback(async () => {
    if (!threadId || !userId || networkStatus === "offline") return

    setLoading(true)
    setError(null)

    try {
      const isLocationChat = !threadId.includes("_") || threadId.startsWith("location_")
      const endpoint = isLocationChat
        ? `/api/location-chat/messages?chatId=${threadId}&userId=${userId}`
        : `/api/chat/messages?chatId=${threadId}`

      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(8000),
      })

      if (!response.ok) {
        if (response.status === 403) {
          setError("You're outside the chat area. Showing cached messages.")
        }
        return
      }

      const data = await response.json()
      const serverMessages: LocationMessageWithUser[] = data.messages || []

      const syncTimestamp = await getSyncTimestamp(`messages:${threadId}`)
      const currentEpoch = (syncTimestamp?.epoch || 0) + 1

      if (currentEpoch < lastFetchEpochRef.current) {
        console.warn("[useMessages] Stale response detected, ignoring")
        return
      }

      lastFetchEpochRef.current = currentEpoch

      const existingPending = await db.messages
        .where("thread_id")
        .equals(threadId)
        .and((msg) => msg.status === "pending" || msg.status === "failed")
        .toArray()

      const pendingClientIds = new Set(existingPending.map((m) => m.client_id))

      await db.messages
        .where("thread_id")
        .equals(threadId)
        .and((msg) => msg.status === "sent" || !msg.status)
        .delete()

      const messagesToCache: CachedMessage[] = serverMessages.map((msg) => ({
        id: msg.id,
        thread_id: threadId,
        user_id: msg.user_id,
        content: msg.content,
        message_type: "text",
        created_at: msg.created_at,
        status: "sent",
        user: msg.user,
      }))

      await db.messages.bulkPut(messagesToCache)

      await setSyncTimestamp(`messages:${threadId}`, currentEpoch)

      const allMessages = await db.messages
        .where("thread_id")
        .equals(threadId)
        .sortBy("created_at")

      setMessages(allMessages)
    } catch (err: any) {
      console.error("[useMessages] Sync error:", err)
      if (err.name !== "AbortError") {
        setError("Unable to fetch latest messages")
      }
    } finally {
      setLoading(false)
    }
  }, [threadId, userId, networkStatus])

  useEffect(() => {
    if (!threadId) {
      setMessages([])
      return
    }

    loadFromCache()
  }, [threadId, loadFromCache])

  useEffect(() => {
    if (!threadId || !userId) return

    syncFromServer()

    const channel = supabase
      .channel(`messages-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "location_messages",
          filter: `chat_id=eq.${threadId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any

          const existing = await db.messages.get(newMsg.id)
          if (existing) return

          const { data: userData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", newMsg.user_id)
            .single()

          const cachedMessage: CachedMessage = {
            id: newMsg.id,
            thread_id: threadId,
            user_id: newMsg.user_id,
            content: newMsg.content,
            message_type: newMsg.message_type || "text",
            created_at: newMsg.created_at,
            status: "sent",
            user: userData || undefined,
          }

          await db.messages.put(cachedMessage)

          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev
            return [...prev, cachedMessage]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId, userId, supabase, syncFromServer])

  const sendMessage = useCallback(
    async (content: string, messageType: "text" | "image" | "gif" = "text") => {
      if (!threadId || !userId || !content.trim()) return

      try {
        const clientId = await addMessageToOutbox(threadId, userId, content, messageType)

        const newMessage = await db.messages.get(clientId)
        if (newMessage) {
          setMessages((prev) => [...prev, newMessage])
        }
      } catch (err) {
        console.error("[useMessages] Send error:", err)
        throw err
      }
    },
    [threadId, userId]
  )

  const retryMessage = useCallback(async (clientId: string) => {
    try {
      await retryFailedMessage(clientId)
      
      const updatedMessage = await db.messages.get(clientId)
      if (updatedMessage) {
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? updatedMessage : m))
        )
      }
    } catch (err) {
      console.error("[useMessages] Retry error:", err)
    }
  }, [])

  return {
    messages,
    loading,
    error,
    sendMessage,
    retryMessage,
    refresh: syncFromServer,
  }
}
