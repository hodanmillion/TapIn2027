import { v4 as uuidv4 } from "uuid"
import { db, OutboxMessage, CachedMessage, getSyncTimestamp, setSyncTimestamp } from "./db"

const MAX_RETRY_COUNT = 5
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 60000

function calculateBackoff(retryCount: number): number {
  const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, retryCount), MAX_BACKOFF_MS)
  const jitter = Math.random() * backoff * 0.3
  return backoff + jitter
}

export async function addMessageToOutbox(
  threadId: string,
  userId: string,
  content: string,
  messageType: "text" | "image" | "gif" = "text"
): Promise<string> {
  const clientId = uuidv4()
  const now = new Date().toISOString()

  const outboxMessage: OutboxMessage = {
    id: clientId,
    client_id: clientId,
    thread_id: threadId,
    user_id: userId,
    content,
    message_type: messageType,
    created_at: now,
    retry_count: 0,
  }

  await db.outbox.add(outboxMessage)

  const pendingMessage: CachedMessage = {
    id: clientId,
    thread_id: threadId,
    user_id: userId,
    content,
    message_type: messageType,
    created_at: now,
    status: "pending",
    client_id: clientId,
  }

  await db.messages.add(pendingMessage)

  return clientId
}

export async function processOutbox(): Promise<void> {
  const pending = await db.outbox.toArray()

  if (pending.length === 0) return

  pending.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  for (const message of pending) {
    if (message.retry_count >= MAX_RETRY_COUNT) {
      await db.messages.update(message.client_id, { status: "failed" })
      await db.outbox.delete(message.id)
      console.error(`[Outbox] Message ${message.client_id} exceeded max retries`)
      continue
    }

    if (message.last_retry_at) {
      const backoff = calculateBackoff(message.retry_count)
      const elapsed = Date.now() - message.last_retry_at
      if (elapsed < backoff) {
        continue
      }
    }

    try {
      const isLocationChat = message.thread_id.startsWith("location_") || !message.thread_id.includes("_")
      
      const endpoint = isLocationChat 
        ? "/api/location-chat/messages"
        : "/api/chat/messages"

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.thread_id,
          user_id: message.user_id,
          content: message.content,
          message_type: message.message_type,
          client_id: message.client_id,
        }),
        signal: AbortSignal.timeout(8000),
      })

      if (response.ok) {
        const data = await response.json()
        const serverId = data.message?.id || data.id

        if (serverId) {
          await db.messages.update(message.client_id, {
            id: serverId,
            status: "sent",
          })
        } else {
          await db.messages.update(message.client_id, { status: "sent" })
        }

        await db.outbox.delete(message.id)
        console.log(`[Outbox] Message ${message.client_id} sent successfully`)
      } else if (response.status === 403) {
        await db.messages.update(message.client_id, { status: "failed" })
        await db.outbox.delete(message.id)
        console.error(`[Outbox] Message ${message.client_id} failed: out of range`)
      } else {
        await db.outbox.update(message.id, {
          retry_count: message.retry_count + 1,
          last_retry_at: Date.now(),
        })
        console.warn(`[Outbox] Message ${message.client_id} retry ${message.retry_count + 1}`)
      }
    } catch (error) {
      await db.outbox.update(message.id, {
        retry_count: message.retry_count + 1,
        last_retry_at: Date.now(),
      })
      console.error(`[Outbox] Message ${message.client_id} error:`, error)
    }
  }
}

export function startOutboxProcessor() {
  if (typeof window === "undefined") {
    return () => {}
  }

  let isProcessing = false

  const process = async () => {
    if (isProcessing) return
    
    isProcessing = true
    try {
      await processOutbox()
    } catch (error) {
      console.error("[Outbox] Processor error:", error)
    } finally {
      isProcessing = false
    }
  }

  const interval = setInterval(process, 3000)

  const handleOnline = () => {
    process()
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      process()
    }
  }

  window.addEventListener("online", handleOnline)
  document.addEventListener("visibilitychange", handleVisibilityChange)

  process()

  return () => {
    clearInterval(interval)
    window.removeEventListener("online", handleOnline)
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}

export async function retryFailedMessage(clientId: string): Promise<void> {
  const message = await db.messages.get(clientId)
  if (!message || message.status !== "failed") return

  const outboxMessage: OutboxMessage = {
    id: uuidv4(),
    client_id: clientId,
    thread_id: message.thread_id,
    user_id: message.user_id,
    content: message.content,
    message_type: message.message_type,
    created_at: message.created_at,
    retry_count: 0,
  }

  await db.outbox.add(outboxMessage)
  await db.messages.update(clientId, { status: "pending" })
  
  await processOutbox()
}