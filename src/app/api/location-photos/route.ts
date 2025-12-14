import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface CachedData {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CachedData>()
const CACHE_TTL = 60000

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chatId = searchParams.get("chatId")
  const latitude = searchParams.get("latitude")
  const longitude = searchParams.get("longitude")
  const radiusParam = searchParams.get("radius")
  const radius = radiusParam ? parseFloat(radiusParam) : 100

  const supabase = await createClient()

  const cacheKey = `${chatId || `${latitude}-${longitude}-${radius}`}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ photos: cached.data }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  }

  try {
    let query = supabase
      .from("location_photos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (chatId) {
      query = query.eq("location_chat_id", chatId)
    } else if (latitude && longitude) {
      const lat = parseFloat(latitude)
      const lng = parseFloat(longitude)
      const latRadius = radius / 111000
      const lngRadius = radius / (111000 * Math.cos((lat * Math.PI) / 180))

      query = query
        .gte("latitude", lat - latRadius)
        .lte("latitude", lat + latRadius)
        .gte("longitude", lng - lngRadius)
        .lte("longitude", lng + lngRadius)
    }

    const { data: photos, error } = await query

    if (error) throw error

    const photosWithUsers = await Promise.all(
      (photos || []).map(async (photo) => {
        const { data: user } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", photo.user_id)
          .single()
        
        return { ...photo, user }
      })
    )

    cache.set(cacheKey, { data: photosWithUsers, timestamp: Date.now() })

    if (cache.size > 100) {
      const oldestKey = Array.from(cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0]
      if (oldestKey) cache.delete(oldestKey)
    }

    return NextResponse.json({ photos: photosWithUsers }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error("Error fetching location photos:", error)
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const chatId = formData.get("chatId") as string
    const caption = formData.get("caption") as string
    const latitude = formData.get("latitude") as string
    const longitude = formData.get("longitude") as string

    if (!file || !latitude || !longitude) {
      return NextResponse.json(
        { error: "File, latitude, and longitude are required" },
        { status: 400 }
      )
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      )
    }

    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("location-photos")
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) throw uploadError

    const {
      data: { publicUrl },
    } = supabase.storage.from("location-photos").getPublicUrl(fileName)

    const { data: photoData, error: insertError } = await supabase
      .from("location_photos")
      .insert({
        location_chat_id: chatId || null,
        user_id: user.id,
        photo_url: publicUrl,
        caption: caption || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      })
      .select("*")
      .single()

    if (insertError) throw insertError

    const { data: userData } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", user.id)
      .single()

    return NextResponse.json({ photo: { ...photoData, user: userData } })
  } catch (error) {
    console.error("Error uploading photo:", error)
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const photoId = searchParams.get("photoId")

  if (!photoId) {
    return NextResponse.json(
      { error: "Photo ID required" },
      { status: 400 }
    )
  }

  try {
    const { data: photo, error: fetchError } = await supabase
      .from("location_photos")
      .select("photo_url, user_id")
      .eq("id", photoId)
      .single()

    if (fetchError) throw fetchError

    if (photo.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized to delete this photo" },
        { status: 403 }
      )
    }

    const fileName = photo.photo_url.split("/location-photos/")[1]

    const { error: deleteStorageError } = await supabase.storage
      .from("location-photos")
      .remove([fileName])

    if (deleteStorageError) throw deleteStorageError

    const { error: deleteDbError } = await supabase
      .from("location_photos")
      .delete()
      .eq("id", photoId)

    if (deleteDbError) throw deleteDbError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting photo:", error)
    return NextResponse.json(
      { error: "Failed to delete photo" },
      { status: 500 }
    )
  }
}