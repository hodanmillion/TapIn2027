import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chatId = searchParams.get("chatId")
  const limit = parseInt(searchParams.get("limit") || "50")
  const before = searchParams.get("before")

  if (!chatId) {
    return NextResponse.json({ error: "Chat ID required" }, { status: 400 })
  }

  let query = supabase
    .from("private_messages")
    .select(`
      id,
      chat_id,
      sender_id,
      content,
      image_url,
      created_at,
      edited_at,
      is_deleted,
      reply_to_id,
      sender:profiles!private_messages_sender_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (before) {
    query = query.lt("created_at", before)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ messages: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { chat_id, sender_id, content, image_url, reply_to_id } = body

  if (!chat_id || !sender_id || (!content && !image_url)) {
    return NextResponse.json({ error: "Chat ID, sender ID, and content or image required" }, { status: 400 })
  }

  const { data: chatData } = await supabase
    .from("private_chats")
    .select("user1_id, user2_id")
    .eq("id", chat_id)
    .single()

  const { data: senderData } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", sender_id)
    .single()

  const { data, error } = await supabase
    .from("private_messages")
    .insert({ chat_id, sender_id, content, image_url, reply_to_id })
    .select(`
      id,
      chat_id,
      sender_id,
      content,
      image_url,
      created_at,
      sender:profiles!private_messages_sender_id_fkey(id, username, display_name, avatar_url)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (chatData && senderData) {
    const recipientId = chatData.user1_id === sender_id ? chatData.user2_id : chatData.user1_id
    const senderName = senderData.display_name || senderData.username || "Someone"
    const preview = content 
      ? (content.length > 50 ? content.substring(0, 50) + "..." : content)
      : "Sent an image"

    await supabase.from("chat_notifications").insert({
      user_id: recipientId,
      chat_type: "private",
      chat_id: chat_id,
      chat_name: senderName,
      message_preview: preview,
      sender_name: senderName,
      sender_avatar: senderData.avatar_url,
    })
  }

  return NextResponse.json({ message: data })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { message_id, user_id, content } = body

  if (!message_id || !user_id || !content?.trim()) {
    return NextResponse.json({ error: "Message ID, user ID, and content required" }, { status: 400 })
  }

  const { data: existingMsg } = await supabase
    .from("private_messages")
    .select("sender_id")
    .eq("id", message_id)
    .single()

  if (!existingMsg || existingMsg.sender_id !== user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("private_messages")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", message_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data })
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const messageId = searchParams.get("messageId")
  const userId = searchParams.get("userId")

  if (!messageId || !userId) {
    return NextResponse.json({ error: "Message ID and user ID required" }, { status: 400 })
  }

  const { data: existingMsg } = await supabase
    .from("private_messages")
    .select("sender_id")
    .eq("id", messageId)
    .single()

  if (!existingMsg || existingMsg.sender_id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { error } = await supabase
    .from("private_messages")
    .update({ is_deleted: true, content: "This message was deleted" })
    .eq("id", messageId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}