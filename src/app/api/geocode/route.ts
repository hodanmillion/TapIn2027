import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = searchParams.get("lat")
    const lng = searchParams.get("lng")
    const address = searchParams.get("address")

    // Forward geocoding: address to coordinates
    if (address) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
          {
            headers: {
              "User-Agent": "TapIn/1.0 (Contact: support@tapin.app)",
              "Accept": "application/json",
            },
            signal: controller.signal,
          }
        )

        clearTimeout(timeoutId)

        if (res.ok) {
          const data = await res.json()
          
          if (data && data.length > 0) {
            const result = data[0]
            return NextResponse.json({ 
              lat: parseFloat(result.lat), 
              lng: parseFloat(result.lon),
              name: result.display_name
            })
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Forward geocoding failed:", err.message || err)
        }
      }

      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      )
    }

    // Reverse geocoding: coordinates to address
    if (!lat || !lng) {
      return NextResponse.json(
        { name: "Unknown Location", city: "Unknown Location" },
        { status: 200 }
      )
    }

    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2500)

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "User-Agent": "TapIn/1.0 (Contact: support@tapin.app)",
            "Accept": "application/json",
          },
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        
        if (data.address) {
          const city =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.county ||
            "Unknown City"

          let name = ""
          
          if (data.address.amenity) name = data.address.amenity
          else if (data.address.building && data.address.building !== "yes") name = data.address.building
          else if (data.address.shop) name = data.address.shop
          else if (data.address.house_number && data.address.road) {
            name = `${data.address.house_number} ${data.address.road}`
          }
          else if (data.address.road) name = data.address.road
          else if (data.address.neighbourhood) name = data.address.neighbourhood
          else if (data.address.suburb) name = data.address.suburb
          else if (data.address.quarter) name = data.address.quarter
          
          if (!name && data.display_name) {
            const displayParts = data.display_name.split(",").map((p: string) => p.trim())
            name = displayParts[0]
          }
          
          if (!name) {
            return NextResponse.json({ name: null, city }, { status: 200 })
          }

          return NextResponse.json({ name, city })
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Geocoding API failed:", err.message || err)
      }
    }

    return NextResponse.json(
      { name: null, city: "Unknown City" },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { name: null, city: "Unknown City" },
      { status: 200 }
    )
  }
}