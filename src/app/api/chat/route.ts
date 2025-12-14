import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 })
  }

  const { data: chats, error } = await supabase
    .from("private_chats")
    .select(`
      id,
      user1_id,
      user2_id,
      created_at,
      user1:profiles!private_chats_user1_id_fkey(id, username, display_name, avatar_url, is_online, bio),
      user2:profiles!private_chats_user2_id_fkey(id, username, display_name, avatar_url, is_online, bio)
    `)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const chatsWithLastMessage = await Promise.all(
    (chats || []).map(async (chat) => {
      const { data: lastMessage } = await supabase
        .from("private_messages")
        .select("content, image_url, created_at")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      return {
        ...chat,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content || (lastMessage.image_url ? "📸 Photo" : null),
              created_at: lastMessage.created_at,
            }
          : null,
      }
    })
  )

  return NextResponse.json({ chats: chatsWithLastMessage })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { user1_id, user2_id } = body

  if (!user1_id || !user2_id) {
    return NextResponse.json({ error: "Both user IDs required" }, { status: 400 })
  }

  const sortedIds = [user1_id, user2_id].sort()

  const { data: existing } = await supabase
    .from("private_chats")
    .select("id")
    .or(`and(user1_id.eq.${sortedIds[0]},user2_id.eq.${sortedIds[1]}),and(user1_id.eq.${sortedIds[1]},user2_id.eq.${sortedIds[0]})`)
    .single()

  if (existing) {
    return NextResponse.json({ chat: existing })
  }

  const { data: newChat, error } = await supabase
    .from("private_chats")
    .insert({ user1_id: sortedIds[0], user2_id: sortedIds[1] })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ chat: newChat })
}