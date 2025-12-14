import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get("userId")
  const limit = parseInt(searchParams.get("limit") || "20")

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("chat_notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: data })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { notificationId, userId, markAll } = body

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 })
  }

  if (markAll) {
    const { error } = await supabase
      .from("chat_notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (notificationId) {
    const { error } = await supabase
      .from("chat_notifications")
      .update({ is_read: true })
      .eq("id", notificationId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("chat_notifications")
    .delete()
    .eq("user_id", userId)
    .eq("is_read", true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
