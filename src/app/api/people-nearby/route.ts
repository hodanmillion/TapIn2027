import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

interface CachedData {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CachedData>()
const CACHE_TTL = 30000

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const city = searchParams.get("city")
  const userId = searchParams.get("userId")
  const scope = searchParams.get("scope") || "city"
  const limitParam = Number(searchParams.get("limit")) || 0
  const latitude = searchParams.get("latitude")
  const longitude = searchParams.get("longitude")
  const radius = Number(searchParams.get("radius")) || 1000

  if (latitude && longitude) {
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
    }

    const cacheKey = `geo-${lat}-${lng}-${radius}-${limitParam}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ people: cached.data }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      })
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, latitude, longitude, city, is_online, last_seen_at")
      .not("latitude", "is", null)
      .not("longitude", "is", null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const now = Date.now()
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000
    
    const processedPeople = (data || [])
      .map(person => {
        const R = 6371000
        const dLat = (person.latitude - lat) * Math.PI / 180
        const dLng = (person.longitude - lng) * Math.PI / 180
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat * Math.PI / 180) * Math.cos(person.latitude * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const distance = R * c

        return {
          ...person,
          distance,
          is_online: person.last_seen_at 
            ? (now - new Date(person.last_seen_at).getTime()) < ONLINE_THRESHOLD_MS
            : false
        }
      })
      .filter(person => person.distance <= radius)
      .sort((a, b) => {
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
        return a.distance - b.distance
      })
      .slice(0, limitParam > 0 ? limitParam : undefined)

    cache.set(cacheKey, { data: processedPeople, timestamp: Date.now() })

    if (cache.size > 100) {
      const oldestKey = Array.from(cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0]
      if (oldestKey) cache.delete(oldestKey)
    }

    return NextResponse.json({ people: processedPeople }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  }

  if (scope !== "world" && !city) {
    return NextResponse.json({ error: "City required" }, { status: 400 })
  }

  const cacheKey = `${scope}-${city}-${userId}-${limitParam}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ people: cached.data }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  }

  let query = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, latitude, longitude, city, is_online, last_seen_at")
    .not("latitude", "is", null)
    .not("longitude", "is", null)

  if (scope === "world") {
    query = query.eq("is_online", true)
  } else {
    query = query.eq("city", city!)
  }

  if (userId) {
    query = query.neq("id", userId)
  }

  query = query.order("is_online", { ascending: false }).order("last_seen_at", { ascending: false })

  if (limitParam > 0) {
    query = query.limit(limitParam)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = Date.now()
  const ONLINE_THRESHOLD_MS = 5 * 60 * 1000
  
  const processedPeople = (data || []).map(person => ({
    ...person,
    is_online: person.last_seen_at 
      ? (now - new Date(person.last_seen_at).getTime()) < ONLINE_THRESHOLD_MS
      : false
  }))

  cache.set(cacheKey, { data: processedPeople, timestamp: Date.now() })

  if (cache.size > 100) {
    const oldestKey = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0]
    if (oldestKey) cache.delete(oldestKey)
  }

  return NextResponse.json({ people: processedPeople }, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { userId, latitude, longitude, city } = body

  if (!userId || latitude === undefined || longitude === undefined || !city) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const now = new Date().toISOString()
  
  const { error } = await supabase
    .from("profiles")
    .update({
      latitude,
      longitude,
      city,
      location_updated_at: now,
      last_seen_at: now,
      is_online: true,
    })
    .eq("id", userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}