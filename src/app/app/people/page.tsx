"use client"

import { useEffect, useState, useCallback, useMemo, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Profile, Tap, TAP_EMOJIS, ChatNotification } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  UserPlus, 
  Search, 
  Bell, 
  Settings, 
  X,
  Check,
  Users,
  Sparkles,
  MapPin,
  MessageCircle,
  Loader2,
  Linkedin
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type FriendWithProfile = {
  id: string
  user_id: string
  friend_id: string
  status: string
  friend: Profile
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

function loadCache() {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("tapin:friends-cache")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function PeopleContent() {
  const initialCache = useMemo(() => loadCache(), [])
  
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [friends, setFriends] = useState<FriendWithProfile[]>(initialCache?.friends || [])
  const [pendingRequests, setPendingRequests] = useState<FriendWithProfile[]>(initialCache?.pendingRequests || [])
  const [recentTaps, setRecentTaps] = useState<(Tap & { sender: Profile })[]>(initialCache?.recentTaps || [])
  const [chatNotifications, setChatNotifications] = useState<ChatNotification[]>(initialCache?.chatNotifications || [])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null)
  const [tappingFriend, setTappingFriend] = useState<string | null>(null)
  const [showTapAnimation, setShowTapAnimation] = useState<{ friendId: string; type: string } | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(!initialCache)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        router.push("/login")
        return
      }
      setUser(user)

      if (initialCache?.userId !== user.id) {
        setFriends([])
        setPendingRequests([])
        setRecentTaps([])
        setChatNotifications([])
      }

      setRefreshing(true)

      const [profileResult, friendsData, pendingData, tapsData, notificationData] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("friendships").select(`
          id,
          user_id,
          friend_id,
          status,
          friend:profiles!friendships_friend_id_fkey(id, username, display_name, avatar_url, last_seen_at, linkedin_url)
        `).eq("user_id", user.id).eq("status", "accepted"),
        supabase.from("friendships").select(`
          id,
          user_id,
          friend_id,
          status,
          friend:profiles!friendships_user_id_fkey(id, username, display_name, avatar_url, last_seen_at, linkedin_url)
        `).eq("friend_id", user.id).eq("status", "pending"),
        supabase.from("taps").select(`
          *,
          sender:profiles!taps_sender_id_fkey(*)
        `).eq("receiver_id", user.id).eq("is_read", false).order("created_at", { ascending: false }).limit(10),
        fetch(`/api/notifications?userId=${user.id}`).then(async res => {
          if (!res.ok) return []
          const data = await res.json()
          return data.notifications || []
        }).catch(() => [])
      ])

      const friendsResult = (friendsData.data as unknown as FriendWithProfile[]) ?? []
      const pendingResult = (pendingData.data as unknown as FriendWithProfile[]) ?? []
      const tapsResult = (tapsData.data as unknown as (Tap & { sender: Profile })[]) ?? []

      setFriends(friendsResult)
      setPendingRequests(pendingResult)
      setRecentTaps(tapsResult)
      setChatNotifications(notificationData)

      if (profileResult?.data) {
        supabase
          .from("profiles")
          .update({ is_online: true, last_seen_at: new Date().toISOString() })
          .eq("id", user.id)
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "tapin:friends-cache",
          JSON.stringify({
            userId: user.id,
            friends: friendsResult,
            pendingRequests: pendingResult,
            recentTaps: tapsResult,
            chatNotifications: notificationData,
          })
        )
      }

      setRefreshing(false)
      setLoading(false)
    }

    getUser().catch(() => {
      setRefreshing(false)
      setLoading(false)
    })
  }, [supabase, router, initialCache])

  useEffect(() => {
    if (!user) return

    const tapsChannel = supabase
      .channel("taps-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "taps",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const { data: senderData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", payload.new.sender_id)
            .single()

          if (senderData) {
            const newTap = { ...payload.new, sender: senderData } as Tap & { sender: Profile }
            setRecentTaps((prev) => [newTap, ...prev])
            setShowTapAnimation({ friendId: payload.new.sender_id, type: payload.new.tap_type })
            setTimeout(() => setShowTapAnimation(null), 2000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(tapsChannel)
    }
  }, [user, supabase])

  const searchUsers = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)

    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", `%${searchQuery}%`)
        .neq("id", user?.id)
        .limit(10)

      setSearchResults(data || [])
    } finally {
      setSearching(false)
    }
  }

  const sendFriendRequest = async (friendId: string) => {
    if (!user) return
    setAddingId(friendId)

    const { data: existing } = await supabase
      .from("friendships")
      .select("*")
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
      .maybeSingle()

    if (existing) {
      toast.info("You already have a request with this user")
      setAddingId(null)
      return
    }

    const { error } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: friendId,
      status: "pending",
    })

    setAddingId(null)

    if (error) {
      toast.error("Could not send request")
      return
    }

    setSearchResults((prev) => prev.filter((p) => p.id !== friendId))
    toast.success("Friend request sent")
  }

  const acceptFriendRequest = async (friendshipId: string, friendUserId: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId)

    if (error) {
      toast.error("Could not accept request")
      return
    }

    const { error: createError } = await supabase.from("friendships").insert({
      user_id: user?.id,
      friend_id: friendUserId,
      status: "accepted",
    })

    if (createError) {
      toast.error("Could not create friendship")
      return
    }

    if (user) {
      const friendsQuery = await supabase.from("friendships").select(`
        id,
        user_id,
        friend_id,
        status,
        friend:profiles!friendships_friend_id_fkey(id, username, display_name, avatar_url, last_seen_at, linkedin_url)
      `).eq("user_id", user.id).eq("status", "accepted")
      setFriends((friendsQuery.data as unknown as FriendWithProfile[]) ?? [])

      const pendingQuery = await supabase.from("friendships").select(`
        id,
        user_id,
        friend_id,
        status,
        friend:profiles!friendships_user_id_fkey(id, username, display_name, avatar_url, last_seen_at, linkedin_url)
      `).eq("friend_id", user.id).eq("status", "pending")
      setPendingRequests((pendingQuery.data as unknown as FriendWithProfile[]) ?? [])
    }

    toast.success("Friend added")
  }

  const declineFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId)

    if (error) {
      toast.error("Could not decline request")
      return
    }

    if (user) {
      const pendingQuery = await supabase.from("friendships").select(`
        id,
        user_id,
        friend_id,
        status,
        friend:profiles!friendships_user_id_fkey(id, username, display_name, avatar_url, last_seen_at, linkedin_url)
      `).eq("friend_id", user.id).eq("status", "pending")
      setPendingRequests((pendingQuery.data as unknown as FriendWithProfile[]) ?? [])
    }

    toast.success("Request declined")
  }

  const sendTap = async (friendId: string, tapType: keyof typeof TAP_EMOJIS) => {
    if (!user) return
    setTappingFriend(friendId)

    await supabase.from("taps").insert({
      sender_id: user.id,
      receiver_id: friendId,
      tap_type: tapType,
    })

    setTimeout(() => setTappingFriend(null), 500)
  }

  const markTapAsRead = async (tapId: string) => {
    await supabase.from("taps").update({ is_read: true }).eq("id", tapId)
    setRecentTaps((prev) => prev.filter((t) => t.id !== tapId))
  }

  const handleChatNotificationClick = async (notification: ChatNotification) => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: notification.id, userId: user?.id }),
    })
    setChatNotifications((prev) => prev.filter((n) => n.id !== notification.id))
    
    if (notification.chat_type === "private") {
      router.push(`/app/chats/${notification.chat_id}`)
    } else {
      router.push(`/app`)
    }
  }

  const totalNotifications = recentTaps.length + pendingRequests.length + chatNotifications.length

  const isUserOnline = (friend: Profile): boolean => {
    if (!friend.last_seen_at) return false
    const now = Date.now()
    const lastSeen = new Date(friend.last_seen_at).getTime()
    return (now - lastSeen) < ONLINE_THRESHOLD_MS
  }

  const showSkeleton = loading && friends.length === 0

  return (
    <div className="min-h-screen flex flex-col bg-background pb-20">
      <header className="sticky top-0 z-50 glass border-b border-border/50 safe-top safe-horizontal">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-400" />
            <span className="text-xl font-bold">Friends</span>
          </div>
          <div className="flex items-center gap-3">
            {refreshing && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Syncing</span>
              </div>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl relative">
                  <Bell className="w-5 h-5" />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full text-xs flex items-center justify-center text-white">
                      {totalNotifications}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="glass border-border/50 max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Notifications</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={req.friend.avatar_url || ""} />
                          <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                            {req.friend.username[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{req.friend.display_name || req.friend.username}</p>
                          <p className="text-xs text-muted-foreground">wants to connect</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          className="h-8 w-8 rounded-lg bg-cyan-500 hover:bg-cyan-600"
                          onClick={() => acceptFriendRequest(req.id, req.friend.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => declineFriendRequest(req.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {recentTaps.map((tap) => (
                    <div
                      key={tap.id}
                      className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl cursor-pointer"
                      onClick={() => markTapAsRead(tap.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={tap.sender.avatar_url || ""} />
                          <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                            {tap.sender.username[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium text-sm">
                          {tap.sender.display_name || tap.sender.username} tapped you
                        </p>
                      </div>
                      <span className="text-2xl">{TAP_EMOJIS[tap.tap_type]}</span>
                    </div>
                  ))}
                  {chatNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl cursor-pointer"
                      onClick={() => handleChatNotificationClick(notif)}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={notif.sender_avatar || ""} />
                        <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                          {notif.sender_name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{notif.sender_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{notif.message_preview}</p>
                      </div>
                    </div>
                  ))}
                  {totalNotifications === 0 && (
                    <p className="text-center text-muted-foreground py-8">No notifications</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="glass border-border/50">
                <DialogHeader>
                  <DialogTitle>Add Friend</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                      className="bg-secondary/50 border-border/50 rounded-xl"
                    />
                    <Button onClick={searchUsers} disabled={searching} className="rounded-xl bg-cyan-500 hover:bg-cyan-600">
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div key={result.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={result.avatar_url || ""} />
                            <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                              {result.username[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{result.display_name || result.username}</p>
                            <p className="text-xs text-muted-foreground">@{result.username}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => sendFriendRequest(result.id)}
                          disabled={addingId === result.id}
                          className="rounded-lg bg-cyan-500 hover:bg-cyan-600"
                        >
                          {addingId === result.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4">
        {showSkeleton ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="glass rounded-2xl p-4 border border-border/50 animate-pulse">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-secondary/60" />
                  <div className="h-4 w-20 bg-secondary/60 rounded-full" />
                  <div className="h-3 w-16 bg-secondary/40 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-border/50">
            <Sparkles className="w-12 h-12 text-cyan-400/50 mx-auto mb-4" />
            <h4 className="text-lg font-medium mb-2">No friends yet</h4>
            <p className="text-muted-foreground mb-4">Add friends to start tapping!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {friends.map((friendship) => {
              const isOnline = isUserOnline(friendship.friend)
              return (
                <button
                  key={friendship.id}
                  className={`glass rounded-2xl p-4 border border-border/50 text-left transition-all hover:border-cyan-500/50 relative ${
                    selectedFriend?.id === friendship.friend.id ? "ring-2 ring-cyan-500" : ""
                  } ${showTapAnimation?.friendId === friendship.friend.id ? "animate-pulse" : ""}`}
                  onClick={() => setSelectedFriend(
                    selectedFriend?.id === friendship.friend.id ? null : friendship.friend
                  )}
                >
                  {showTapAnimation?.friendId === friendship.friend.id && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50 rounded-2xl">
                      <span className="text-5xl">
                        {TAP_EMOJIS[showTapAnimation.type as keyof typeof TAP_EMOJIS]}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-3">
                      <Avatar className="w-14 h-14">
                        <AvatarImage src={friendship.friend.avatar_url || ""} />
                        <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-lg">
                          {friendship.friend.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-card" />
                      )}
                    </div>
                    <p className="font-medium truncate w-full text-sm">
                      {friendship.friend.display_name || friendship.friend.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isOnline ? "Online" : "Offline"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {selectedFriend && (
        <div className="fixed bottom-20 left-0 right-0 glass border-t border-border/50 p-4 z-40">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedFriend.avatar_url || ""} />
                  <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                    {selectedFriend.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">
                  {selectedFriend.display_name || selectedFriend.username}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={async () => {
                    const res = await fetch("/api/chat", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ user1_id: user?.id, user2_id: selectedFriend.id }),
                    })
                    const data = await res.json()
                    if (data.chat) {
                      router.push(`/app/chats/${data.chat.id}`)
                    }
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Chat
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setSelectedFriend(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            {selectedFriend.linkedin_url && (
              <div className="flex justify-center mb-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  <a
                    href={selectedFriend.linkedin_url.startsWith("http") ? selectedFriend.linkedin_url : `https://${selectedFriend.linkedin_url}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Linkedin className="w-4 h-4 mr-2" />
                    LinkedIn
                  </a>
                </Button>
              </div>
            )}
            <div className="flex justify-center gap-3">
              {(Object.keys(TAP_EMOJIS) as (keyof typeof TAP_EMOJIS)[]).map((tapType) => (
                <button
                  key={tapType}
                  onClick={() => sendTap(selectedFriend.id, tapType)}
                  disabled={tappingFriend === selectedFriend.id}
                  className={`w-12 h-12 rounded-xl bg-secondary/50 hover:bg-secondary flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95 ${
                    tappingFriend === selectedFriend.id ? "animate-pulse" : ""
                  }`}
                >
                  {TAP_EMOJIS[tapType]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 z-50">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-around">
          <Link href="/app" className="flex flex-col items-center gap-1 py-2 px-6">
            <MapPin className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Nearby</span>
          </Link>
          <Link href="/app/people" className="flex flex-col items-center gap-1 py-2 px-6">
            <Users className="w-6 h-6 text-cyan-400" />
            <span className="text-xs text-cyan-400 font-medium">Friends</span>
          </Link>
          <Link href="/app/chats" className="flex flex-col items-center gap-1 py-2 px-6">
            <MessageCircle className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Chats</span>
          </Link>
          <Link href="/app/settings" className="flex flex-col items-center gap-1 py-2 px-6">
            <Settings className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}

export default function PeoplePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    }>
      <PeopleContent />
    </Suspense>
  )
}