import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const messageIds = searchParams.get("messageIds")?.split(",")

  if (!messageIds || messageIds.length === 0) {
    return NextResponse.json({ reactions: {} })
  }

  const { data, error } = await supabase
    .from("message_reactions")
    .select("id, message_id, user_id, emoji, created_at")
    .in("message_id", messageIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const reactionsByMessage: Record<string, { emoji: string; user_id: string; id: string }[]> = {}
  data?.forEach((r) => {
    if (!reactionsByMessage[r.message_id]) {
      reactionsByMessage[r.message_id] = []
    }
    reactionsByMessage[r.message_id].push({ emoji: r.emoji, user_id: r.user_id, id: r.id })
  })

  return NextResponse.json({ reactions: reactionsByMessage })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { message_id, user_id, emoji } = body

  if (!message_id || !user_id || !emoji) {
    return NextResponse.json({ error: "Message ID, user ID, and emoji required" }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", message_id)
    .eq("user_id", user_id)
    .eq("emoji", emoji)
    .single()

  if (existing) {
    await supabase.from("message_reactions").delete().eq("id", existing.id)
    return NextResponse.json({ action: "removed" })
  }

  const { data, error } = await supabase
    .from("message_reactions")
    .insert({ message_id, user_id, emoji })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reaction: data, action: "added" })
}
