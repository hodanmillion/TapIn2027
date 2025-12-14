"use client"

import { useEffect, useState, useRef, useCallback, memo, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Profile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Send, Loader2, Smile, Image, X, Heart, Sparkles, MoreVertical, Edit, Trash, Copy, Reply, Check, CheckCheck, WifiOff } from "lucide-react"
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react"
import GifPicker, { TenorImage } from "gif-picker-react"

type Reaction = {
  emoji: string
  user_id: string
  id: string
}

type Message = {
  id: string
  chat_id: string
  sender_id: string
  content: string | null
  image_url: string | null
  created_at: string
  edited_at?: string | null
  is_deleted?: boolean
  reply_to_id?: string | null
  sender: Profile
  reactions?: Reaction[]
  reply_to?: {
    id: string
    content: string | null
    sender: { username: string }
  } | null
  read_by?: Array<{ user_id: string; read_at: string }>
}

type ChatInfo = {
  id: string
  user1_id: string
  user2_id: string
  user1: Profile
  user2: Profile
}

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"]
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

const groupReactions = (reactions: Reaction[]) => {
  const grouped: Record<string, string[]> = {}
  reactions.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = []
    grouped[r.emoji].push(r.user_id)
  })
  return grouped
}

const MessageBubble = memo(function MessageBubble({ 
  msg, 
  isOwn, 
  userId,
  onTap,
  onDoubleTap,
  onReaction,
  onEdit,
  onDelete,
  onCopy,
  onReply,
  showMenu,
  setShowMenu,
  editingMessageId,
  editContent,
  setEditContent,
  handleEditMessage,
  setEditingMessageId,
  selectedMessageId
}: any) {
  const isGif = msg.content?.includes("tenor.com") || msg.content?.includes("giphy.com") || msg.content?.match(/\.(gif|webp)(\?|$)/i)
  const groupedReactions = groupReactions(msg.reactions || [])
  const showReactionPicker = selectedMessageId === msg.id

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className={`flex mb-3 ${isOwn ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex items-end gap-2 max-w-[80%] ${isOwn ? "flex-row-reverse" : ""} relative`}>
        {!isOwn && (
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={msg.sender.avatar_url || ""} loading="lazy" />
            <AvatarFallback className="bg-primary/20 text-primary text-sm">
              {msg.sender.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="relative group">
          {msg.reply_to && (
            <div className={`mb-2 pl-3 border-l-2 ${isOwn ? "border-primary-foreground/50" : "border-primary/50"}`}>
              <p className={`text-xs ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                Replying to {msg.reply_to.sender.username}
              </p>
              <p className={`text-sm ${isOwn ? "text-primary-foreground/80" : "text-foreground/80"} truncate`}>
                {msg.reply_to.content || "Image"}
              </p>
            </div>
          )}
          
          {editingMessageId === msg.id ? (
            <div className="flex gap-2 items-center bg-secondary/70 rounded-2xl px-4 py-3">
              <Input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleEditMessage()
                  }
                  if (e.key === "Escape") {
                    setEditingMessageId(null)
                    setEditContent("")
                  }
                }}
                className="bg-background/50 border-none"
                autoFocus
              />
              <Button size="sm" onClick={handleEditMessage} className="h-8">
                <Send className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setEditingMessageId(null)
                setEditContent("")
              }} className="h-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div
              onClick={() => onTap(msg.id)}
              onDoubleClick={() => onDoubleTap(msg.id)}
              className={`rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                isGif
                  ? "p-1 bg-transparent"
                  : `px-4 py-3 ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary/70 rounded-bl-md"
                    }`
              } ${msg.is_deleted ? "italic opacity-60" : ""}`}
            >
              {msg.image_url && (
                <img
                  src={msg.image_url}
                  alt="Shared image"
                  loading="lazy"
                  className="rounded-lg max-w-full mb-2"
                />
              )}
              {isGif ? (
                <img
                  src={msg.content || ""}
                  alt="GIF"
                  loading="lazy"
                  className="rounded-xl max-w-full max-h-[200px] object-contain"
                />
              ) : (
                msg.content && !msg.image_url && <p className="break-words text-base">{msg.content}</p>
              )}
              {!isGif && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatTime(msg.created_at)}
                  {msg.edited_at && !msg.is_deleted && <span>(edited)</span>}
                  {isOwn && !msg.is_deleted && (
                    msg.read_by && msg.read_by.some((r: any) => r.user_id !== userId) ? (
                      <CheckCheck className="w-3 h-3 text-primary" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )
                  )}
                </p>
              )}
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(showMenu === msg.id ? null : msg.id)
            }}
            className={`absolute ${isOwn ? "-left-8" : "-right-8"} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-secondary/80 hover:bg-secondary`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu === msg.id && (
            <div 
              className={`absolute ${isOwn ? "right-0" : "left-0"} bottom-full mb-2 w-40 bg-card rounded-lg shadow-lg border border-border animate-in zoom-in-95 duration-150 z-50 overflow-hidden`}
            >
              <button
                onClick={() => {
                  onReply(msg)
                  setShowMenu(null)
                }}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-secondary/70 transition-colors text-left text-sm"
              >
                <Reply className="w-4 h-4" />
                Reply
              </button>
              {!msg.is_deleted && msg.content && (
                <button
                  onClick={() => {
                    onCopy(msg.content!)
                    setShowMenu(null)
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-secondary/70 transition-colors text-left text-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              )}
              {isOwn && !msg.is_deleted && (
                <>
                  <button
                    onClick={() => {
                      onEdit(msg.id, msg.content || "")
                      setShowMenu(null)
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-secondary/70 transition-colors text-left text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      onDelete(msg.id)
                      setShowMenu(null)
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-destructive/70 text-destructive transition-colors text-left text-sm"
                  >
                    <Trash className="w-4 h-4" />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}

          {showReactionPicker && (
            <div 
              className={`absolute ${isOwn ? "right-0" : "left-0"} bottom-full mb-2 flex gap-1 p-2 bg-card rounded-full shadow-lg border border-border animate-in zoom-in-95 duration-150 z-50`}
            >
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => onReaction(msg.id, emoji)}
                  className="text-xl hover:scale-125 transition-transform p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {Object.keys(groupedReactions).length > 0 && (
            <div className={`flex gap-1 mt-1 flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}>
              {Object.entries(groupedReactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => onReaction(msg.id, emoji)}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all hover:scale-110 ${
                    (users as string[]).includes(userId || "")
                      ? "bg-primary/20 border border-primary/50"
                      : "bg-secondary/50 border border-transparent"
                  }`}
                >
                  <span>{emoji}</span>
                  {(users as string[]).length > 1 && <span className="text-muted-foreground">{(users as string[]).length}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default function ChatPage() {
  const params = useParams()
  const chatId = params.chatId as string
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTapRef = useRef<{ messageId: string; time: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessagesLengthRef = useRef(0)
  const router = useRouter()
  const supabase = createClient()

  // Cache helpers
  const getChatCache = useCallback(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = localStorage.getItem(`tapin:chat:${chatId}`)
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  }, [chatId])

  const setChatCache = useCallback((data: { messages: Message[]; chatInfo: ChatInfo }) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(`tapin:chat:${chatId}`, JSON.stringify(data))
    } catch {}
  }, [chatId])

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load from cache first
  useEffect(() => {
    const cached = getChatCache()
    if (cached) {
      setMessages(cached.messages || [])
      setChatInfo(cached.chatInfo || null)
      setLoading(false)
    }
  }, [getChatCache])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const checkIfNearBottom = () => {
    if (!messagesContainerRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    return distanceFromBottom < 100
  }

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      isNearBottomRef.current = checkIfNearBottom()
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom()
      isNearBottomRef.current = true
    }
  }, [chatId])

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current && isNearBottomRef.current) {
      scrollToBottom()
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages, loading])

  const fetchReactions = useCallback(async (messageIds: string[]) => {
    try {
      if (messageIds.length === 0) return {}
      const res = await fetch(`/api/chat/reactions?messageIds=${messageIds.join(",")}`)
      if (!res.ok) return {}
      const data = await res.json()
      return data.reactions || {}
    } catch {
      return {}
    }
  }, [])

  const fetchReadReceipts = useCallback(async (messageIds: string[]) => {
    try {
      if (messageIds.length === 0) return {}
      const res = await fetch(`/api/chat/read-receipts?messageIds=${messageIds.join(",")}`)
      if (!res.ok) return {}
      const data = await res.json()
      return data.receipts || {}
    } catch {
      return {}
    }
  }, [])

  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return
    await fetch("/api/chat/read-receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_ids: messageIds, user_id: user.id }),
    })
  }, [user])

  const fetchMessages = useCallback(async () => {
    if (!isOnline) return

    try {
      const res = await fetch(`/api/chat/messages?chatId=${chatId}`)
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json()
      if (data.messages) {
        const messageIds = data.messages.map((m: Message) => m.id)
        const replyToIds = data.messages.filter((m: Message) => m.reply_to_id).map((m: Message) => m.reply_to_id)
        
        const [reactions, receipts] = await Promise.all([
          fetchReactions(messageIds),
          fetchReadReceipts(messageIds)
        ])
        
        const replyToMap: Record<string, { id: string; content: string | null; sender: { username: string } }> = {}
        
        data.messages?.forEach((m: Message) => {
          if (replyToIds.includes(m.id)) {
            replyToMap[m.id] = {
              id: m.id,
              content: m.content,
              sender: { username: m.sender.username }
            }
          }
        })
        
        const messagesWithData = data.messages.map((m: Message) => ({
          ...m,
          reactions: reactions[m.id] || [],
          read_by: receipts[m.id] || [],
          reply_to: m.reply_to_id ? replyToMap[m.reply_to_id] : null,
        }))
        setMessages(messagesWithData)
        
        if (chatInfo) {
          setChatCache({ messages: messagesWithData, chatInfo })
        }
        
        const unreadMessages = messagesWithData
          .filter((m: Message) => m.sender_id !== user?.id && !receipts[m.id]?.some((r: { user_id: string }) => r.user_id === user?.id))
          .map((m: Message) => m.id)
        if (unreadMessages.length > 0) {
          markMessagesAsRead(unreadMessages)
        }
      }
    } catch {
      setMessages([])
    }
    setLoading(false)
  }, [chatId, user?.id, isOnline, chatInfo])

  const updateReactionsForMessage = useCallback(async (messageId: string) => {
    const reactions = await fetchReactions([messageId])
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions: reactions[messageId] || [] } : m))
    )
  }, [fetchReactions])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      setUser(user)

      const res = await fetch(`/api/chat?userId=${user.id}`)
      const data = await res.json()
      const chat = data.chats?.find((c: ChatInfo) => c.id === chatId)
      if (chat) {
        setChatInfo(chat)
      }
      
      fetchMessages()
    }
    getUser()
  }, [supabase, router, chatId, fetchMessages])

  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          const { data: senderData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", payload.new.sender_id)
            .single()

          if (senderData) {
            const newMsg = { ...payload.new, sender: senderData, reactions: [] } as Message
            setMessages((prev) => [...prev, newMsg])
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        async (payload) => {
          const messageId = (payload.new as { message_id?: string } | null)?.message_id || (payload.old as { message_id?: string } | null)?.message_id
          if (messageId) {
            await updateReactionsForMessage(messageId)
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_read_receipts",
        },
        async (payload) => {
          const messageId = (payload.new as { message_id?: string } | null)?.message_id
          if (messageId) {
            const receipts = await fetchReadReceipts([messageId])
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, read_by: receipts[messageId] || [] } : m))
            )
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            if (payload.new.user_id !== user?.id) {
              setOtherUserTyping(true)
              setTimeout(() => setOtherUserTyping(false), 3000)
            }
          } else if (payload.eventType === "DELETE") {
            if (payload.old.user_id !== user?.id) {
              setOtherUserTyping(false)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, supabase, user?.id, updateReactionsForMessage, fetchReadReceipts])

  const handleTyping = useCallback(async () => {
    if (!user || !chatId) return

    if (!isTyping) {
      setIsTyping(true)
      await fetch("/api/chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: user.id }),
      })
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false)
      await fetch(`/api/chat/typing?chatId=${chatId}&userId=${user.id}`, {
        method: "DELETE",
      })
    }, 2000)
  }, [user, chatId, isTyping])

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || sending) return
    
    const messageContent = newMessage.trim()
    const tempId = `temp-${Date.now()}`
    
    const optimisticMessage: Message = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: messageContent,
      image_url: null,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        username: 'You',
        display_name: 'You',
        avatar_url: chatInfo?.user1_id === user.id ? chatInfo?.user1.avatar_url : chatInfo?.user2.avatar_url,
        is_online: true,
      } as Profile,
      reactions: [],
      reply_to: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        sender: { username: replyingTo.sender.username }
      } : null,
      reply_to_id: replyingTo?.id || null
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setNewMessage("")
    setReplyingTo(null)
    setSending(true)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    setIsTyping(false)

    if (!isOnline) {
      const pendingQueue = JSON.parse(localStorage.getItem(`tapin:pending:${chatId}`) || '[]')
      pendingQueue.push({
        chat_id: chatId,
        sender_id: user.id,
        content: messageContent,
        reply_to_id: replyingTo?.id || null,
        tempId
      })
      localStorage.setItem(`tapin:pending:${chatId}`, JSON.stringify(pendingQueue))
      setSending(false)
      return
    }

    try {
      await Promise.race([
        fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            sender_id: user.id,
            content: messageContent,
            reply_to_id: replyingTo?.id || null,
          }),
        }),
        fetch("/api/chat/typing?chatId=${chatId}&userId=${user.id}", {
          method: "DELETE",
        })
      ])

      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setSending(false)
    }
  }

  // Retry pending messages when back online
  useEffect(() => {
    if (!isOnline || !user) return

    const retryPending = async () => {
      const pendingQueue = JSON.parse(localStorage.getItem(`tapin:pending:${chatId}`) || '[]')
      if (pendingQueue.length === 0) return

      for (const msg of pendingQueue) {
        try {
          await fetch("/api/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(msg),
          })
          setMessages((prev) => prev.filter((m) => m.id !== msg.tempId))
        } catch {}
      }

      localStorage.removeItem(`tapin:pending:${chatId}`)
      fetchMessages()
    }

    retryPending()
  }, [isOnline, user, chatId, fetchMessages])

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji)
    setShowEmojiPicker(false)
  }

  const handleGifSelect = async (gif: TenorImage) => {
    if (!user) return
    setShowGifPicker(false)
    setSending(true)

    await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        sender_id: user.id,
        content: gif.url,
      }),
    })

    setSending(false)
  }

  const handleImageUpload = async (file?: File) => {
    if (!user || !file) return
    setUploadingImage(true)
    setShowEmojiPicker(false)
    setShowGifPicker(false)

    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch("/api/chat/upload", {
      method: "POST",
      body: formData,
    })

    if (!res.ok) {
      setUploadingImage(false)
      return
    }

    const { url } = await res.json()

    await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        sender_id: user.id,
        image_url: url,
        content: "📸 Photo",
      }),
    })

    setUploadingImage(false)
  }

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return
    setSelectedMessageId(null)

    await fetch("/api/chat/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: messageId,
        user_id: user.id,
        emoji,
      }),
    })

    await updateReactionsForMessage(messageId)
  }

  const handleMessageTap = (messageId: string) => {
    const now = Date.now()
    if (lastTapRef.current && lastTapRef.current.messageId === messageId && now - lastTapRef.current.time < 300) {
      handleReaction(messageId, "❤️")
      lastTapRef.current = null
    } else {
      lastTapRef.current = { messageId, time: now }
    }
  }

  const handleEditMessage = async () => {
    if (!editContent.trim() || !editingMessageId || !user) return

    await fetch("/api/chat/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: editingMessageId,
        user_id: user.id,
        content: editContent.trim(),
      }),
    })

    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingMessageId
          ? { ...m, content: editContent.trim(), edited_at: new Date().toISOString() }
          : m
      )
    )

    setEditingMessageId(null)
    setEditContent("")
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return

    await fetch(`/api/chat/messages?messageId=${messageId}&userId=${user.id}`, {
      method: "DELETE",
    })

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, is_deleted: true, content: "This message was deleted" } : m
      )
    )
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const getOtherUser = () => {
    if (!chatInfo || !user) return null
    return chatInfo.user1_id === user.id ? chatInfo.user2 : chatInfo.user1
  }

  const otherUser = getOtherUser()

  const isOtherUserOnline = useMemo(() => {
    if (!otherUser?.last_seen_at) return false
    const now = Date.now()
    const lastSeen = new Date(otherUser.last_seen_at).getTime()
    return (now - lastSeen) < ONLINE_THRESHOLD_MS
  }, [otherUser?.last_seen_at])

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    }
    return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })
  }

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: Message[] }[] = []
    let currentDate = ""

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString()
      if (msgDate !== currentDate) {
        currentDate = msgDate
        groups.push({ date: msg.created_at, messages: [msg] })
      } else {
        groups[groups.length - 1].messages.push(msg)
      }
    })

    return groups
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr_auto] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      <header className="sticky top-0 z-50 glass border-b border-border/50 safe-top safe-horizontal">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/app/chats">
            <Button variant="ghost" size="icon" className="rounded-xl flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          {otherUser && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={otherUser.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {otherUser.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isOtherUserOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent rounded-full border-2 border-card" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-base truncate">{otherUser.display_name || otherUser.username}</p>
                <p className="text-sm text-muted-foreground">
                  {otherUserTyping ? (
                    <span className="text-primary flex items-center gap-1">
                      typing
                      <span className="inline-flex gap-0.5">
                        <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </span>
                  ) : isOtherUserOnline ? "Online" : "Offline"}
                </p>
              </div>
              {!isOnline && (
                <div className="flex items-center gap-1 text-xs text-amber-500">
                  <WifiOff className="w-4 h-4" />
                  <span>Offline</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div 
        ref={messagesContainerRef}
        className="overflow-y-auto px-4 py-4 relative z-10 overscroll-contain"
      >
        <div className="max-w-4xl mx-auto">
          {groupMessagesByDate().map((group, groupIdx) => (
            <div key={groupIdx}>
              <div className="flex justify-center my-4">
                <span className="px-3 py-1 text-sm text-muted-foreground bg-secondary/50 rounded-full animate-in fade-in duration-300">
                  {formatDate(group.date)}
                </span>
              </div>
              {group.messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={isOwn}
                    userId={user?.id}
                    onTap={handleMessageTap}
                    onDoubleTap={(id: string) => handleReaction(id, "❤️")}
                    onReaction={handleReaction}
                    onEdit={(id: string, content: string) => {
                      setEditingMessageId(id)
                      setEditContent(content)
                    }}
                    onDelete={handleDeleteMessage}
                    onCopy={handleCopyMessage}
                    onReply={setReplyingTo}
                    showMenu={showMessageMenu}
                    setShowMenu={setShowMessageMenu}
                    editingMessageId={editingMessageId}
                    editContent={editContent}
                    setEditContent={setEditContent}
                    handleEditMessage={handleEditMessage}
                    setEditingMessageId={setEditingMessageId}
                    selectedMessageId={selectedMessageId}
                  />
                )
              })}
            </div>
          ))}

          {otherUserTyping && (
            <div className="flex justify-start mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2">
                {otherUser && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={otherUser.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {otherUser.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="px-4 py-3 bg-secondary/70 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 z-50 glass border-t border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 relative">
          {replyingTo && (
            <div className="mb-2 flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
              <Reply className="w-4 h-4 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  Replying to {replyingTo.sender.username}
                </p>
                <p className="text-sm truncate">{replyingTo.content || "Image"}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => setReplyingTo(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              handleImageUpload(file)
              e.target.value = ""
            }}
          />
          {showEmojiPicker && (
            <div className="absolute bottom-20 left-4 right-4 z-50">
              <div className="relative max-w-sm mx-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 z-10 rounded-full bg-secondary h-8 w-8"
                  onClick={() => setShowEmojiPicker(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.DARK}
                  width="100%"
                  height={350}
                  previewConfig={{ showPreview: false }}
                />
              </div>
            </div>
          )}
          {showGifPicker && (
            <div className="absolute bottom-20 left-4 right-4 z-50">
              <div className="relative max-w-sm mx-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 z-10 rounded-full bg-secondary h-8 w-8"
                  onClick={() => setShowGifPicker(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <GifPicker
                  tenorApiKey={process.env.NEXT_PUBLIC_TENOR_API_KEY || ""}
                  onGifClick={handleGifSelect}
                  theme={Theme.DARK}
                  width="100%"
                  height={350}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl h-12 w-12 flex-shrink-0"
              onClick={() => {
                setShowGifPicker(false)
                setShowEmojiPicker(!showEmojiPicker)
              }}
            >
              <Smile className="w-5 h-5 text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl h-12 w-12 flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage || sending}
            >
              {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Image className="w-5 h-5 text-primary" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl h-12 w-12 flex-shrink-0"
              onClick={() => {
                setShowEmojiPicker(false)
                setShowGifPicker(!showGifPicker)
              }}
            >
              <Sparkles className="w-5 h-5 text-primary" />
            </Button>
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                handleTyping()
              }}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              className="bg-secondary/50 border-border/50 rounded-xl flex-1 h-12 text-base"
              onFocus={() => {
                setShowEmojiPicker(false)
                setShowGifPicker(false)
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || uploadingImage}
              className="rounded-xl h-12 w-12 transition-all duration-200 hover:scale-105 active:scale-95"
              size="icon"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}