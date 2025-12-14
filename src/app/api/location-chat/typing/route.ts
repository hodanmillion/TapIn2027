import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { chat_id, user_id } = body

  if (!chat_id || !user_id) {
    return NextResponse.json({ error: "Chat ID and user ID required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("location_typing_indicators")
    .upsert(
      { chat_id, user_id, updated_at: new Date().toISOString() },
      { onConflict: "chat_id,user_id" }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chatId = searchParams.get("chatId")
  const userId = searchParams.get("userId")

  if (!chatId || !userId) {
    return NextResponse.json({ error: "Chat ID and user ID required" }, { status: 400 })
  }

  await supabase
    .from("location_typing_indicators")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", userId)

  return NextResponse.json({ success: true })
}
