import { memo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  MoreVertical,
  Edit,
  Trash,
  Copy,
  Reply,
  Check,
  CheckCheck,
  X,
  Send,
  Loader2,
} from "lucide-react"

type Reaction = {
  emoji: string
  user_id: string
  id: string
}

type LocationMessage = {
  id: string
  chat_id: string
  user_id: string
  content: string | null
  created_at: string
  edited_at?: string | null
  is_deleted?: boolean
  reply_to_id?: string | null
  message_type?: string
  user?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
  }
  reactions?: Reaction[]
  reply_to?: {
    id: string
    content: string | null
    user: { username: string }
  } | null
  read_by?: Array<{ user_id: string; read_at: string }>
  status?: "pending" | "failed"
  client_id?: string
}

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"]

const groupReactions = (reactions: Reaction[]) => {
  const grouped: Record<string, string[]> = {}
  reactions.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = []
    grouped[r.emoji].push(r.user_id)
  })
  return grouped
}

export const LocationMessageBubble = memo(function LocationMessageBubble({
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
  selectedMessageId,
  onRetry,
}: {
  msg: LocationMessage
  isOwn: boolean
  userId?: string
  onTap: (id: string) => void
  onDoubleTap: (id: string) => void
  onReaction: (id: string, emoji: string) => void
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  onCopy: (content: string) => void
  onReply: (msg: LocationMessage) => void
  showMenu: string | null
  setShowMenu: (id: string | null) => void
  editingMessageId: string | null
  editContent: string
  setEditContent: (content: string) => void
  handleEditMessage: () => void
  setEditingMessageId: (id: string | null) => void
  selectedMessageId: string | null
  onRetry?: (clientId: string) => void
}) {
  const isGif = msg.content?.includes("tenor.com") || msg.content?.includes("giphy.com") || msg.content?.match(/\.(gif|webp)(\?|$)/i)
  const isImage = msg.message_type === "image" || (msg.content?.startsWith("data:image") || msg.content?.match(/\.(png|jpe?g|webp|heic|bmp)(\?|$)/i))
  const groupedReactions = groupReactions(msg.reactions || [])
  const showReactionPicker = selectedMessageId === msg.id
  const isPending = msg.status === "pending"
  const isFailed = msg.status === "failed"

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className={`flex mb-3 ${isOwn ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex items-end gap-2 max-w-[80%] ${isOwn ? "flex-row-reverse" : ""} relative`}>
        {!isOwn && (
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={msg.user?.avatar_url || ""} loading="lazy" />
            <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-sm">
              {msg.user?.username?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="relative group">
          {msg.reply_to && (
            <div className={`mb-2 pl-3 border-l-2 ${isOwn ? "border-cyan-500/50" : "border-primary/50"}`}>
              <p className={`text-xs ${isOwn ? "text-cyan-100/60" : "text-muted-foreground"}`}>
                Replying to {msg.reply_to.user.username}
              </p>
              <p className={`text-sm ${isOwn ? "text-cyan-100/80" : "text-foreground/80"} truncate`}>
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
                isGif || isImage
                  ? "p-1 bg-transparent"
                  : `px-4 py-3 ${
                      isOwn
                        ? isFailed
                          ? "bg-rose-500/20 text-white rounded-tr-sm border border-rose-500/40"
                          : "bg-cyan-500 text-white rounded-tr-sm"
                        : "bg-secondary/70 rounded-tl-sm"
                    }`
              } ${msg.is_deleted ? "italic opacity-60" : ""} ${isPending ? "opacity-70" : ""}`}
            >
              {isGif || isImage ? (
                <img
                  src={msg.content || ""}
                  alt={isGif ? "GIF" : "Image"}
                  loading="lazy"
                  className="rounded-xl max-w-full max-h-[220px] object-contain"
                />
              ) : (
                msg.content && <p className="break-words text-base">{msg.content}</p>
              )}
              {!isGif && !isImage && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${isOwn ? "text-cyan-100/70" : "text-muted-foreground"}`}>
                  {formatTime(msg.created_at)}
                  {msg.edited_at && !msg.is_deleted && <span>(edited)</span>}
                  {isOwn && !msg.is_deleted && (
                    msg.read_by && msg.read_by.some((r: any) => r.user_id !== userId) ? (
                      <CheckCheck className="w-3 h-3 text-cyan-200" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )
                  )}
                  {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                </p>
              )}
            </div>
          )}

          {!msg.is_deleted && !editingMessageId && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(showMenu === msg.id ? null : msg.id)
              }}
              className={`absolute ${isOwn ? "-left-8" : "-right-8"} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-secondary/80 hover:bg-secondary`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}

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
                      ? "bg-cyan-500/20 border border-cyan-500/50"
                      : "bg-secondary/50 border border-transparent"
                  }`}
                >
                  <span>{emoji}</span>
                  {(users as string[]).length > 1 && <span className="text-muted-foreground">{(users as string[]).length}</span>}
                </button>
              ))}
            </div>
          )}

          {isFailed && isOwn && msg.client_id && onRetry && (
            <Button
              onClick={() => onRetry(msg.client_id!)}
              variant="ghost"
              size="sm"
              className="mt-1 text-xs text-rose-400 hover:text-rose-300 h-auto py-1 px-2"
            >
              Tap to retry
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
