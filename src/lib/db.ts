import Dexie, { Table } from "dexie"

export type MessageStatus = "pending" | "sent" | "failed"

export interface CachedFriend {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  is_online: boolean
  updated_at: number
}

export interface CachedProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  last_seen_at: string | null
  updated_at: number
}

export interface CachedThread {
  id: string
  type: "private" | "location"
  participant_ids?: string[]
  location_name?: string
  latitude?: string
  longitude?: string
  last_message_at?: string
  last_message_preview?: string
  last_message_sender_id?: string
  last_message_image_url?: string
  updated_at: number
}

export interface CachedMessage {
  id: string
  thread_id: string
  user_id: string
  content: string
  message_type: "text" | "image" | "gif"
  created_at: string
  status?: MessageStatus
  client_id?: string
  user?: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

export interface OutboxMessage {
  id: string
  client_id: string
  thread_id: string
  user_id: string
  content: string
  message_type: "text" | "image" | "gif"
  created_at: string
  retry_count: number
  last_retry_at?: number
}

export interface SyncTimestamp {
  resource: string
  last_sync_at: number
  epoch: number
}

class TapInDatabase extends Dexie {
  friends!: Table<CachedFriend, string>
  profiles!: Table<CachedProfile, string>
  threads!: Table<CachedThread, string>
  messages!: Table<CachedMessage, string>
  outbox!: Table<OutboxMessage, string>
  sync_timestamps!: Table<SyncTimestamp, string>

  constructor() {
    super("TapInDB")
    
    this.version(2).stores({
      friends: "id, updated_at",
      profiles: "id, updated_at",
      threads: "id, type, updated_at, last_message_at",
      messages: "id, thread_id, created_at, status, client_id",
      outbox: "id, client_id, thread_id, created_at, retry_count",
      sync_timestamps: "resource, last_sync_at, epoch",
    })
  }
}

export const db = new TapInDatabase()

export async function clearAllCache() {
  await Promise.all([
    db.friends.clear(),
    db.profiles.clear(),
    db.threads.clear(),
    db.messages.clear(),
    db.outbox.clear(),
    db.sync_timestamps.clear(),
  ])
}

export async function getSyncTimestamp(resource: string): Promise<SyncTimestamp | undefined> {
  return db.sync_timestamps.get(resource)
}

export async function setSyncTimestamp(resource: string, epoch?: number) {
  const existing = await getSyncTimestamp(resource)
  await db.sync_timestamps.put({
    resource,
    last_sync_at: Date.now(),
    epoch: epoch ?? (existing?.epoch || 0) + 1,
  })
}