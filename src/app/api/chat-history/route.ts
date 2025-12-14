import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HISTORY_HOURS = 48

async function cleanupOldHistory() {
  const cutoff = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000).toISOString()
  
  const { data: oldVisits } = await supabaseAdmin
    .from("chat_visit_history")
    .select("id, user_id, chat_id")
    .lt("visited_at", cutoff)
  
  if (oldVisits && oldVisits.length > 0) {
    const { data: userMessages } = await supabaseAdmin
      .from("location_messages")
      .select("chat_id, user_id")
      .in("chat_id", oldVisits.map(v => v.chat_id))
      .in("user_id", oldVisits.map(v => v.user_id))
    
    const participatedCombos = new Set(
      (userMessages || []).map(m => `${m.user_id}:${m.chat_id}`)
    )
    
    const visitsToDelete = oldVisits.filter(v => 
      !participatedCombos.has(`${v.user_id}:${v.chat_id}`)
    )
    
    if (visitsToDelete.length > 0) {
      await supabaseAdmin
        .from("chat_visit_history")
        .delete()
        .in("id", visitsToDelete.map(v => v.id))
    }
  }
  
  await supabaseAdmin
    .from("chat_visit_history")
    .delete()
    .lt("visited_at", cutoff)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  await cleanupOldHistory()

  const cutoff = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from("chat_visit_history")
    .select("*, chat:location_chats(*)")
    .eq("user_id", userId)
    .gte("visited_at", cutoff)
    .order("visited_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const validHistory = (data || []).filter((item) => item.chat !== null)

  return NextResponse.json({ history: validHistory })
}

export async function POST(request: Request) {
  let body
  try {
    body = await request.json()
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { user_id, chat_id, location_name, action } = body

  if (!user_id || !chat_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  await cleanupOldHistory()
  const now = new Date().toISOString()

  if (action === "join") {
    await supabaseAdmin
      .from("chat_visit_history")
      .update({ is_current: false })
      .eq("user_id", user_id)
      .eq("is_current", true)

    const { data: existing } = await supabaseAdmin
      .from("chat_visit_history")
      .select("*")
      .eq("user_id", user_id)
      .eq("chat_id", chat_id)
      .single()

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("chat_visit_history")
        .update({
          visited_at: now,
          is_current: true,
          left_at: null,
        })
        .eq("id", existing.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ visit: data })
    }

    const { data, error } = await supabaseAdmin
      .from("chat_visit_history")
      .insert({
        user_id,
        chat_id,
        location_name,
        is_current: true,
        visited_at: now,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ visit: data })
  }

  if (action === "leave") {
    const { data, error } = await supabaseAdmin
      .from("chat_visit_history")
      .update({
        is_current: false,
        left_at: now,
      })
      .eq("user_id", user_id)
      .eq("chat_id", chat_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ visit: data })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}