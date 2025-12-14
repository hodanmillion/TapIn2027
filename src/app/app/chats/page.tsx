"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageCircle, MapPin, Users, Settings, Loader2, RefreshCcw, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useThreads } from "@/hooks/useThreads"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { OfflineBanner } from "@/components/OfflineBanner"
import { formatDistanceToNow } from "date-fns"
import { db } from "@/lib/db"

type ChatPreview = {
  id: string
  otherUserId: string
  otherUsername: string
  otherDisplayName?: string
  otherAvatarUrl?: string
  otherIsOnline: boolean
  lastMessageContent?: string
  lastMessageImageUrl?: string
  lastMessageAt?: string
  lastMessageSenderId?: string
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

function ChatsContent() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([])
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const networkStatus = useNetworkStatus()
  const { threads, loading, lastSyncedAt, refresh } = useThreads(user?.id || null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      setUser(user)
    }
    getUser()
  }, [supabase, router])

  useEffect(() => {
    if (!user) return

    const privateThreads = threads.filter(t => t.type === "private")
    
    if (privateThreads.length === 0) {
      setChatPreviews([])
      return
    }

    const otherUserIds = privateThreads
      .map(t => t.participant_ids?.find(id => id !== user.id))
      .filter(Boolean) as string[]

    if (otherUserIds.length === 0) {
      setChatPreviews([])
      return
    }

    const buildPreviews = async () => {
      try {
        const profiles = await db.profiles.bulkGet(otherUserIds)
        const profileMap = new Map(profiles.filter(Boolean).map(p => [p!.id, p]))

        const uncachedIds = otherUserIds.filter(id => !profileMap.has(id))
        
        if (uncachedIds.length > 0 && networkStatus === "online") {
          const { data } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, last_seen_at")
            .in("id", uncachedIds)

          if (data) {
            const now = Date.now()
            await db.profiles.bulkPut(data.map(p => ({ ...p, updated_at: now })))
            data.forEach(profile => profileMap.set(profile.id, profile))
          }
        }

        const now = Date.now()
        const previews: ChatPreview[] = privateThreads
          .map(thread => {
            const otherUserId = thread.participant_ids?.find(id => id !== user.id)
            if (!otherUserId) return null

            const profile = profileMap.get(otherUserId)
            if (!profile) return null

            const isOnline = profile.last_seen_at 
              ? (now - new Date(profile.last_seen_at).getTime()) < ONLINE_THRESHOLD_MS
              : false

            return {
              id: thread.id,
              otherUserId,
              otherUsername: profile.username,
              otherDisplayName: profile.display_name,
              otherAvatarUrl: profile.avatar_url,
              otherIsOnline: isOnline,
              lastMessageContent: thread.last_message_preview,
              lastMessageSenderId: thread.last_message_sender_id,
              lastMessageImageUrl: thread.last_message_image_url,
              lastMessageAt: thread.last_message_at,
            }
          })
          .filter(Boolean) as ChatPreview[]

        setChatPreviews(previews)
        
        previews.forEach(chat => {
          router.prefetch(`/app/chats/${chat.id}`)
        })
      } catch (err) {
        console.error("[ChatsPage] Error building previews:", err)
      }
    }

    buildPreviews()
  }, [threads, user, supabase, networkStatus, router])

  const formatTime = (dateString?: string) => {
    if (!dateString) return ""
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return ""
    }
  }

  const formatMessagePreview = (chat: ChatPreview) => {
    if (!chat.lastMessageContent && !chat.lastMessageImageUrl) return ""
      
    const isOwnMessage = chat.lastMessageSenderId === user?.id
    const prefix = isOwnMessage ? "You: " : ""
    
    if (chat.lastMessageImageUrl) {
      return (
        <span className="flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" />
          {prefix}Photo
        </span>
      )
    }
    
    return prefix + (chat.lastMessageContent || "")
  }

  return (
    <>
      <OfflineBanner />
      <div className="min-h-screen flex flex-col bg-background pb-20">
        <header className="sticky top-0 z-50 glass border-b border-border/50 safe-top safe-horizontal">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-cyan-400" />
              <span className="text-xl font-bold">Private Chats</span>
            </div>
            <div className="flex items-center gap-2">
              {loading && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing</span>
                </div>
              )}
              {networkStatus === "offline" && lastSyncedAt && (
                <div className="text-xs text-muted-foreground">
                  Synced {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={refresh}
                disabled={loading || networkStatus === "offline"}
                className="rounded-xl"
              >
                <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4">
          {loading && chatPreviews.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-border/50">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            </div>
          ) : chatPreviews.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-border/50">
              <MessageCircle className="w-12 h-12 text-cyan-400/50 mx-auto mb-4" />
              <h4 className="text-lg font-medium mb-2">No chats yet</h4>
              <p className="text-muted-foreground">Start a conversation with a friend!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chatPreviews.map((chat) => (
                <Link key={chat.id} href={`/app/chats/${chat.id}`} prefetch={true}>
                  <div className="glass rounded-2xl p-4 border border-border/50 hover:border-cyan-500/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={chat.otherAvatarUrl || ""} />
                          <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                            {chat.otherUsername[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {chat.otherIsOnline && (
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">
                            {chat.otherDisplayName || chat.otherUsername}
                          </p>
                          {chat.lastMessageAt && (
                            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                              {formatTime(chat.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {formatMessagePreview(chat)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 z-50">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-around">
            <Link href="/app" className="flex flex-col items-center gap-1 py-2 px-6">
              <MapPin className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Nearby</span>
            </Link>
            <Link href="/app/people" className="flex flex-col items-center gap-1 py-2 px-6">
              <Users className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Friends</span>
            </Link>
            <div className="flex flex-col items-center gap-1 py-2 px-6">
              <MessageCircle className="w-6 h-6 text-cyan-400" />
              <span className="text-xs text-cyan-400 font-medium">Chats</span>
            </div>
            <Link href="/app/settings" className="flex flex-col items-center gap-1 py-2 px-6">
              <Settings className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Settings</span>
            </Link>
          </div>
        </nav>
      </div>
    </>
  )
}

export default function ChatsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    }>
      <ChatsContent />
    </Suspense>
  )
}