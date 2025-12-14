import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PROXIMITY_RADIUS_METERS = 50
const STAGNANT_HOURS = 48

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
  const cutoff = new Date(Date.now() - STAGNANT_HOURS * 60 * 60 * 1000).toISOString()
  
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
  const lat = parseFloat(searchParams.get("lat") || "0")
  const lng = parseFloat(searchParams.get("lng") || "0")
  const radius = parseFloat(searchParams.get("radius") || "5")
  const city = searchParams.get("city")
  const getStats = searchParams.get("stats") === "true"
  const autoJoin = searchParams.get("auto_join") === "true"

  cleanupStagnantChats()

  if (autoJoin && lat && lng) {
    const latDelta = (PROXIMITY_RADIUS_METERS / 111000) * 2
    const lngDelta = (PROXIMITY_RADIUS_METERS / (111000 * Math.cos(lat * Math.PI / 180))) * 2
    
    const { data: nearbyChats } = await supabaseAdmin
      .from("location_chats")
      .select("*")
      .gte("latitude", lat - latDelta)
      .lte("latitude", lat + latDelta)
      .gte("longitude", lng - lngDelta)
      .lte("longitude", lng + lngDelta)
      .order("created_at", { ascending: true })

    if (nearbyChats && nearbyChats.length > 0) {
      for (const chat of nearbyChats) {
        const dist = getDistanceMeters(lat, lng, parseFloat(chat.latitude), parseFloat(chat.longitude))
        if (dist <= PROXIMITY_RADIUS_METERS) {
          await supabaseAdmin
            .from("location_chats")
            .update({ last_activity: new Date().toISOString() })
            .eq("id", chat.id)
          return NextResponse.json({ chat, joined: true, distance: Math.round(dist) })
        }
      }
    }

    const locationName = searchParams.get("name") || `Zone ${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const { data: newChat, error } = await supabaseAdmin
      .from("location_chats")
      .insert({ 
        location_name: locationName, 
        latitude: lat, 
        longitude: lng,
        last_activity: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ chat: newChat, joined: true, created: true })
  }

  if (getStats) {
    const { data: users } = await supabaseAdmin
      .from("profiles")
      .select("city, latitude, longitude, is_online")
      .not("city", "is", null)

    const { data: chats } = await supabaseAdmin
      .from("location_chats")
      .select("*")

    const cityStats: Record<string, { 
      userCount: number
      onlineCount: number
      chatCount: number
      lat: number
      lng: number
      chats: { id: string; name: string; messageCount: number }[]
    }> = {}

    users?.forEach((user) => {
      if (!user.city) return
      if (!cityStats[user.city]) {
        cityStats[user.city] = {
          userCount: 0,
          onlineCount: 0,
          chatCount: 0,
          lat: parseFloat(user.latitude) || 0,
          lng: parseFloat(user.longitude) || 0,
          chats: [],
        }
      }
      cityStats[user.city].userCount++
      if (user.is_online) cityStats[user.city].onlineCount++
    })

    chats?.forEach((chat) => {
      const chatLat = parseFloat(chat.latitude)
      const chatLng = parseFloat(chat.longitude)
      
      let closestCity = ""
      let closestDist = Infinity
      
      Object.keys(cityStats).forEach((city) => {
        const dist = Math.sqrt(
          Math.pow(cityStats[city].lat - chatLat, 2) + 
          Math.pow(cityStats[city].lng - chatLng, 2)
        )
        if (dist < closestDist) {
          closestDist = dist
          closestCity = city
        }
      })
      
      if (closestCity && closestDist < 1) {
        cityStats[closestCity].chatCount++
        cityStats[closestCity].chats.push({
          id: chat.id,
          name: chat.location_name,
          messageCount: chat.message_count,
        })
      }
    })

    return NextResponse.json({ stats: cityStats })
  }

  if (city) {
    const { data: cityChat } = await supabaseAdmin
      .from("location_chats")
      .select("*")
      .eq("location_name", city)
      .single()

    if (cityChat) {
      return NextResponse.json({ chats: [cityChat] })
    }

    const { data: newChat, error } = await supabaseAdmin
      .from("location_chats")
      .insert({ location_name: city, latitude: lat, longitude: lng, last_activity: new Date().toISOString() })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ chats: [newChat] })
  }

  const latMin = lat - radius / 111
  const latMax = lat + radius / 111
  const lngMin = lng - radius / (111 * Math.cos(lat * Math.PI / 180))
  const lngMax = lng + radius / (111 * Math.cos(lat * Math.PI / 180))

  const { data, error } = await supabaseAdmin
    .from("location_chats")
    .select("*")
    .gte("latitude", latMin)
    .lte("latitude", latMax)
    .gte("longitude", lngMin)
    .lte("longitude", lngMax)
    .order("last_activity", { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ chats: data })
}

export async function POST(request: Request) {
  let body
  try {
    body = await request.json()
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { location_name, latitude, longitude, auto_join } = body

  if (!location_name || !latitude || !longitude) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  cleanupStagnantChats()

  if (auto_join && latitude && longitude) {
    const latDelta = (PROXIMITY_RADIUS_METERS / 111000) * 2
    const lngDelta = (PROXIMITY_RADIUS_METERS / (111000 * Math.cos(latitude * Math.PI / 180))) * 2
    
    const { data: nearbyChats } = await supabaseAdmin
      .from("location_chats")
      .select("*")
      .gte("latitude", latitude - latDelta)
      .lte("latitude", latitude + latDelta)
      .gte("longitude", longitude - lngDelta)
      .lte("longitude", longitude + lngDelta)
      .order("created_at", { ascending: true })

    if (nearbyChats && nearbyChats.length > 0) {
      for (const chat of nearbyChats) {
        const dist = getDistanceMeters(latitude, longitude, parseFloat(chat.latitude), parseFloat(chat.longitude))
        if (dist <= PROXIMITY_RADIUS_METERS) {
          await supabaseAdmin
            .from("location_chats")
            .update({ last_activity: new Date().toISOString() })
            .eq("id", chat.id)
          return NextResponse.json({ chat, joined: true, distance: Math.round(dist) })
        }
      }
    }

    const baseName = location_name || `Zone ${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const attemptCreate = async (name: string) => supabaseAdmin
      .from("location_chats")
      .insert({ 
        location_name: name, 
        latitude, 
        longitude,
        last_activity: new Date().toISOString()
      })
      .select()
      .single()

    let nameToUse = baseName
    let { data: newChat, error: insertError } = await attemptCreate(nameToUse)

    if (insertError && insertError.message.includes("duplicate key value")) {
      nameToUse = `${baseName} • ${Math.abs(Math.round(latitude * 1000) / 1000)},${Math.abs(Math.round(longitude * 1000) / 1000)}`
      const retry = await attemptCreate(nameToUse)
      newChat = retry.data
      insertError = retry.error || null

      if (insertError && insertError.message.includes("duplicate key value")) {
        const fallbackName = `Zone ${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        const fallback = await attemptCreate(fallbackName)
        newChat = fallback.data
        insertError = fallback.error || null
      }
    }

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ chat: newChat, created: true })
  }

  const { data: existing } = await supabaseAdmin
    .from("location_chats")
    .select("*")
    .eq("location_name", location_name)
    .single()

  if (existing) {
    await supabaseAdmin
      .from("location_chats")
      .update({ last_activity: new Date().toISOString() })
      .eq("id", existing.id)
    return NextResponse.json({ chat: existing })
  }

  const { data, error } = await supabaseAdmin
    .from("location_chats")
    .insert({ location_name, latitude, longitude, last_activity: new Date().toISOString() })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ chat: data })
}