export type Profile = {
  id: string
  username: string
  display_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  location?: {
    type: string
    coordinates: number[]
  } | null
  is_online?: boolean
  last_seen?: string | null
  push_token?: string | null
}

export type Friendship = {
  id: string
  user_id: string
  friend_id: string
  status: "pending" | "accepted" | "blocked"
  created_at: string
  updated_at: string
}

export type FriendshipWithProfile = Friendship & {
  friend: Profile
}

export type Tap = {
  id: string
  sender_id: string
  receiver_id: string
  tap_type: "wave" | "poke" | "heart" | "fire" | "star"
  message: string | null
  is_read: boolean
  created_at: string
}

export type TapWithSender = Tap & {
  sender: Profile
}

export const TAP_EMOJIS = {
  wave: "👋",
  poke: "👉",
  heart: "❤️",
  fire: "🔥",
  star: "⭐",
} as const

export type LocationChat = {
  id: string
  location_name: string
  latitude: number
  longitude: number
  created_at: string
  updated_at: string
  message_count: number
}

export type LocationMessage = {
  id: string
  chat_id: string
  user_id: string
  content: string
  created_at: string
  message_type?: "text" | "image" | "gif"
  reply_to_id?: string | null
  edited_at?: string | null
  is_deleted?: boolean
  client_id?: string
}

export type LocationMessageWithUser = LocationMessage & {
  user: Profile
}

export type ChatNotification = {
  id: string
  user_id: string
  chat_type: "location" | "private"
  chat_id: string
  chat_name: string
  message_preview: string
  sender_name: string
  sender_avatar: string | null
  is_read: boolean
  created_at: string
}