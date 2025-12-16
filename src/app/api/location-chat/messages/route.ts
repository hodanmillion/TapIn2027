import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

const STAGNANT_HOURS = 48
const PROXIMITY_RADIUS_METERS = 50
const CLEANUP_INTERVAL = 60 * 60 * 1000
let lastCleanup = 0

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

async function cleanupStagnantChats() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return
  }
  lastCleanup = now

  const cutoff = new Date(now - STAGNANT_HOURS * 60 * 60 * 1000).toISOString()

  await supabaseAdmin
    .from("location_messages")
    .delete()
    .lt("created_at", cutoff)

  const { data: stagnantChats } = await supabaseAdmin
    .from("location_chats")
    .select("id")
    .lt("last_activity", cutoff)

  if (stagnantChats && stagnantChats.length > 0) {
    const ids = stagnantChats.map(c => c.id)
    await supabaseAdmin
      .from("location_messages")
      .delete()
      .in("chat_id", ids)
    await supabaseAdmin
      .from("location_chats")
      .delete()
      .in("id", ids)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chatId = searchParams.get("chatId")
  const userId = searchParams.get("userId")

  if (!chatId || !userId) {
    return NextResponse.json({ error: "chatId and userId required" }, { status: 400 })
  }

  cleanupStagnantChats().catch(() => {})

  const [chatResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from("location_chats")
      .select("latitude, longitude")
      .eq("id", chatId)
      .single(),
    supabaseAdmin
      .from("profiles")
      .select("latitude, longitude")
      .eq("id", userId)
      .single()
  ])

  const chatLat = Number(chatResult.data?.latitude)
  const chatLng = Number(chatResult.data?.longitude)
  const userLat = Number(profileResult.data?.latitude)
  const userLng = Number(profileResult.data?.longitude)

  if (!Number.isFinite(chatLat) || !Number.isFinite(chatLng) || !Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    return NextResponse.json({ error: "location_unavailable" }, { status: 403 })
  }

  const distance = getDistanceMeters(chatLat, chatLng, userLat, userLng)
  if (distance > PROXIMITY_RADIUS_METERS) {
    return NextResponse.json({ error: "outside_radius" }, { status: 403 })
  }

  const cutoff = new Date(Date.now() - STAGNANT_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from("location_messages")
    .select(`
      *,
      user:profiles(id, username, display_name, avatar_url)
    `)
    .eq("chat_id", chatId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ messages: data }, {
    headers: {
      'Cache-Control': 'private, no-cache',
    },
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { chat_id, user_id, content, message_type, reply_to_id } = body

    console.log('[LocationChatMessages] POST received:', { chat_id, user_id, content: content?.substring(0, 50), message_type, reply_to_id })

    if (!chat_id || !user_id || !content) {
      console.error('[LocationChatMessages] Missing fields:', { chat_id: !!chat_id, user_id: !!user_id, content: !!content })
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    cleanupStagnantChats().catch(() => {})

    const [chatResult, senderResult] = await Promise.all([
      supabaseAdmin
        .from("location_chats")
        .select("location_name, latitude, longitude")
        .eq("id", chat_id)
        .single(),
      supabaseAdmin
        .from("profiles")
        .select("username, display_name, avatar_url, city, latitude, longitude")
        .eq("id", user_id)
        .single()
    ])

    const chatData = chatResult.data
    const senderData = senderResult.data

    if (!chatData || !senderData) {
      console.error('[LocationChatMessages] Missing data:', { chat: !!chatData, sender: !!senderData })
      return NextResponse.json({ error: "Chat or user not found" }, { status: 404 })
    }

    const chatLat = Number(chatData?.latitude)
    const chatLng = Number(chatData?.longitude)
    const userLat = Number(senderData?.latitude)
    const userLng = Number(senderData?.longitude)

    if (!Number.isFinite(chatLat) || !Number.isFinite(chatLng) || !Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      console.error('[LocationChatMessages] Invalid coordinates:', { chatLat, chatLng, userLat, userLng })
      return NextResponse.json({ error: "location_unavailable" }, { status: 403 })
    }

    const distance = getDistanceMeters(chatLat, chatLng, userLat, userLng)
    console.log('[LocationChatMessages] Distance check:', { distance, limit: PROXIMITY_RADIUS_METERS, allowed: distance <= PROXIMITY_RADIUS_METERS })
    
    if (distance > PROXIMITY_RADIUS_METERS) {
      return NextResponse.json({ error: "outside_radius", distance }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from("location_messages")
      .insert({
        chat_id,
        user_id,
        content,
        message_type: message_type || "text",
        reply_to_id: reply_to_id || null,
      })
      .select(`
        *,
        user:profiles(id, username, display_name, avatar_url)
      `)
      .single()

    if (error) {
      console.error('[LocationChatMessages] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const updatePromises = [
      supabaseAdmin
        .from("location_chats")
        .update({ 
          updated_at: new Date().toISOString(),
          last_activity: new Date().toISOString()
        })
        .eq("id", chat_id)
    ]

    if (senderData?.city && chatData && content.length <= 50) {
      updatePromises.push(
        (async () => {
          try {
            const { data: nearbyUsers } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("city", senderData.city)
              .neq("id", user_id)
              .limit(50)
            
            if (nearbyUsers && nearbyUsers.length > 0) {
              const notifications = nearbyUsers.map(u => ({
                user_id: u.id,
                chat_type: "location",
                chat_id: chat_id,
                chat_name: chatData.location_name,
                message_preview: content.length > 50 ? content.substring(0, 50) + "..." : content,
                sender_name: senderData.display_name || senderData.username || "Anonymous",
                sender_avatar: senderData.avatar_url,
              }))
              await supabaseAdmin.from("chat_notifications").insert(notifications)
            }
          } catch {}
        })()
      )
    }

    await Promise.allSettled(updatePromises)

    return NextResponse.json({ message: data })
  } catch {
    console.error('[LocationChatMessages] Unexpected error')
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { message_id, user_id, content } = body

    if (!message_id || !user_id || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data: message } = await supabaseAdmin
      .from("location_messages")
      .select("user_id")
      .eq("id", message_id)
      .single()

    if (!message || message.user_id !== user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from("location_messages")
      .update({ content, edited_at: new Date().toISOString() })
      .eq("id", message_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: data })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")
    const userId = searchParams.get("userId")

    if (!messageId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data: message } = await supabaseAdmin
      .from("location_messages")
      .select("user_id")
      .eq("id", messageId)
      .single()

    if (!message || message.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from("location_messages")
      .update({ is_deleted: true, content: "This message was deleted" })
      .eq("id", messageId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}