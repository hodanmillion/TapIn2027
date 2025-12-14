import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { message_ids, user_id } = body

  if (!message_ids || !Array.isArray(message_ids) || !user_id) {
    return NextResponse.json({ error: "Message IDs array and user ID required" }, { status: 400 })
  }

  const receipts = message_ids.map(message_id => ({
    message_id,
    user_id,
  }))

  const { error } = await supabase
    .from("message_read_receipts")
    .upsert(receipts, { onConflict: "message_id,user_id" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const messageIds = searchParams.get("messageIds")

  if (!messageIds) {
    return NextResponse.json({ error: "Message IDs required" }, { status: 400 })
  }

  const ids = messageIds.split(",")

  const { data, error } = await supabase
    .from("message_read_receipts")
    .select("message_id, user_id, read_at")
    .in("message_id", ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const grouped: Record<string, Array<{ user_id: string; read_at: string }>> = {}
  data?.forEach(receipt => {
    if (!grouped[receipt.message_id]) {
      grouped[receipt.message_id] = []
    }
    grouped[receipt.message_id].push({
      user_id: receipt.user_id,
      read_at: receipt.read_at,
    })
  })

  return NextResponse.json({ receipts: grouped })
}
