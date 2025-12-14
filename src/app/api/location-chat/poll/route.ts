import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PROXIMITY_RADIUS_METERS = 20

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function emptyVotes() {
  return { connect: 0, chill: 0, group: 0 }
}

async function fetchCounts(chatId: string) {
  const votes = emptyVotes()
  const { data } = await supabaseAdmin
    .from("location_poll_votes")
    .select("option")
    .eq("chat_id", chatId)

  if (data) {
    data.forEach((row) => {
      if (row.option === "connect") votes.connect++
      if (row.option === "chill") votes.chill++
      if (row.option === "group") votes.group++
    })
  }

  return votes
}

async function checkProximity(chatId: string, userId: string) {
  const { data: chatData } = await supabaseAdmin
    .from("location_chats")
    .select("latitude, longitude")
    .eq("id", chatId)
    .single()

  const { data: profileData } = await supabaseAdmin
    .from("profiles")
    .select("latitude, longitude")
    .eq("id", userId)
    .single()

  const chatLat = Number(chatData?.latitude)
  const chatLng = Number(chatData?.longitude)
  const userLat = Number(profileData?.latitude)
  const userLng = Number(profileData?.longitude)

  if (!Number.isFinite(chatLat) || !Number.isFinite(chatLng) || !Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    return { error: "location_unavailable" }
  }

  const distance = getDistanceMeters(chatLat, chatLng, userLat, userLng)
  if (distance > PROXIMITY_RADIUS_METERS) {
    return { error: "outside_radius" }
  }

  return { distance }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chatId = searchParams.get("chatId")
  const userId = searchParams.get("userId")

  if (!chatId || !userId) {
    return NextResponse.json({ error: "chatId and userId required" }, { status: 400 })
  }

  const proximity = await checkProximity(chatId, userId)
  if (proximity.error) {
    return NextResponse.json({ error: proximity.error }, { status: 403 })
  }

  const votes = await fetchCounts(chatId)

  const { data: existing } = await supabaseAdmin
    .from("location_poll_votes")
    .select("option")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .single()

  return NextResponse.json({ votes, user_vote: existing?.option || null })
}

export async function POST(request: Request) {
  let chat_id, user_id, option
  
  try {
    const body = await request.json()
    chat_id = body.chat_id
    user_id = body.user_id
    option = body.option
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!chat_id || !user_id || !option) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  if (!["connect", "chill", "group"].includes(option)) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 })
  }

  const proximity = await checkProximity(chat_id, user_id)
  if (proximity.error) {
    return NextResponse.json({ error: proximity.error }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from("location_poll_votes")
    .upsert({ chat_id, user_id, option }, { onConflict: "chat_id,user_id" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const votes = await fetchCounts(chat_id)

  return NextResponse.json({ votes, option })
}