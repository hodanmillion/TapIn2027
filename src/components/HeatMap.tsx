"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet.heat"
import { Search, X, Loader2, MapPin } from "lucide-react"

declare module "leaflet" {
  function heatLayer(
    latlngs: [number, number, number?][],
    options?: {
      radius?: number
      blur?: number
      maxZoom?: number
      max?: number
      gradient?: { [key: number]: string }
    }
  ): L.Layer
}

type Person = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  latitude: number
  longitude: number
  is_online: boolean
}

type LocationPhoto = {
  id: string
  photo_url: string
  caption: string | null
  latitude: number
  longitude: number
  user: {
    username: string
    display_name: string | null
  }
}

type AreaStats = {
  userCount: number
  onlineCount: number
  chatCount: number
  lat: number
  lng: number
  chats: { id: string; name: string; messageCount: number }[]
  photos?: LocationPhoto[]
}

type HeatMapProps = {
  people: Person[]
  center: [number, number]
  currentUserLocation?: [number, number]
  onPersonClick?: (person: Person) => void
  areaStats?: Record<string, AreaStats>
  onAreaClick?: (cityName: string, stats: AreaStats) => void
  onPhotoClick?: (lat: number, lng: number) => void
  onMapClick?: (lat: number, lng: number) => void
  photos?: LocationPhoto[]
}

type SearchResult = {
  name: string
  lat: number
  lng: number
  displayName: string
}

type LocationActivity = {
  userCount: number
  onlineCount: number
  users: Array<{ username: string; display_name: string | null; is_online: boolean }>
  chatCount: number
  photoCount: number
}

function SearchBar({ onSearchResult }: { onSearchResult: (lat: number, lng: number, name: string) => void }) {
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        {
          headers: {
            "User-Agent": "TapIn/1.0 (Contact: support@tapin.app)",
            "Accept": "application/json",
          },
        }
      )

      if (res.ok) {
        const data = await res.json()
        const searchResults: SearchResult[] = data.map((item: any) => ({
          name: item.name || item.display_name.split(",")[0],
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          displayName: item.display_name,
        }))
        setResults(searchResults)
        setShowResults(true)
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query) handleSearch(query)
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [query])

  const handleResultClick = (result: SearchResult) => {
    onSearchResult(result.lat, result.lng, result.name)
    setQuery("")
    setResults([])
    setShowResults(false)
  }

  return (
    <div className="absolute top-20 left-3 z-[1000] w-full max-w-[280px]">
      <div className="relative">
        <div className="flex items-center gap-2 bg-black/80 border border-cyan-500/40 rounded-xl px-3 py-2 shadow-lg">
          <Search className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any location..."
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-gray-400"
            onFocus={() => results.length > 0 && setShowResults(true)}
          />
          {searching && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />}
          {query && !searching && (
            <button
              onClick={() => {
                setQuery("")
                setResults([])
                setShowResults(false)
              }}
              className="flex-shrink-0"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
          )}
        </div>

        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 border border-cyan-500/40 rounded-xl overflow-hidden shadow-xl max-h-[240px] overflow-y-auto">
            {results.map((result, idx) => (
              <button
                key={idx}
                onClick={() => handleResultClick(result)}
                className="w-full px-4 py-3 text-left hover:bg-cyan-500/20 transition-colors border-b border-gray-800 last:border-b-0"
              >
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{result.name}</p>
                    <p className="text-xs text-gray-400 truncate">{result.displayName}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityPanel({ lat, lng, locationName, onClose }: { lat: number; lng: number; locationName: string; onClose: () => void }) {
  const [activity, setActivity] = useState<LocationActivity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/people-nearby?latitude=${lat}&longitude=${lng}&radius=1000&limit=50`)
        if (res.ok) {
          const data = await res.json()
          const users = data.people || []
          setActivity({
            userCount: users.length,
            onlineCount: users.filter((u: any) => u.is_online).length,
            users: users.slice(0, 10),
            chatCount: 0,
            photoCount: 0,
          })
        }
      } catch (error) {
        console.error('[ActivityPanel] Failed to fetch:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchActivity()
  }, [lat, lng])

  return (
    <div className="absolute top-16 right-3 z-[1000] w-72 bg-black/95 border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden">
      <div className="p-3 border-b border-cyan-500/30 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm truncate">{locationName}</h3>
          <p className="text-xs text-gray-400">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      ) : activity ? (
        <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-cyan-400">{activity.userCount}</div>
              <div className="text-xs text-cyan-300/80">Total Users</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-400">{activity.onlineCount}</div>
              <div className="text-xs text-green-300/80">Online Now</div>
            </div>
          </div>

          {activity.users.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-2">NEARBY USERS</h4>
              <div className="space-y-1.5">
                {activity.users.map((user, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                    <div className={`w-2 h-2 rounded-full ${user.is_online ? 'bg-green-400' : 'bg-gray-500'}`} />
                    <span className="text-sm text-white truncate flex-1">
                      {user.display_name || user.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activity.userCount === 0 && (
            <div className="text-center py-8 text-gray-400">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No activity at this location</p>
              <p className="text-xs mt-1">Be the first to TapIn!</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-center text-gray-400">
          <p className="text-sm">Unable to load activity</p>
        </div>
      )}
    </div>
  )
}

function Recenter({ centerLat, centerLng, zoom }: { centerLat: number; centerLng: number; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    const current = map.getCenter()
    const currentZoom = map.getZoom()
    const latDiff = Math.abs(current.lat - centerLat)
    const lngDiff = Math.abs(current.lng - centerLng)
    const zoomChanged = currentZoom !== zoom
    if (latDiff > 0.00001 || lngDiff > 0.00001 || zoomChanged) {
      map.setView([centerLat, centerLng], zoom)
    }
  }, [map, centerLat, centerLng, zoom])

  return null
}

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || points.length === 0) return

    const heat = L.heatLayer(points, {
      radius: 30,
      blur: 25,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.2: "#22d3ee",
        0.4: "#06b6d4",
        0.6: "#0891b2",
        0.8: "#f97316",
        1.0: "#ef4444",
      },
    })

    heat.addTo(map)

    return () => {
      map.removeLayer(heat)
    }
  }, [map, points])

  return null
}

function FitAllControl({ points }: { points: [number, number][] }) {
  const map = useMap()
  const bounds = useMemo(() => {
    if (!points.length) return null
    return L.latLngBounds(points)
  }, [points])

  if (!map || !bounds) return null

  return (
    <div className="leaflet-top leaflet-right pointer-events-none">
      <button
        className="mt-20 mr-3 px-3 py-2 rounded-xl bg-black/70 text-white text-xs font-semibold border border-cyan-500/40 shadow-lg shadow-cyan-500/25 pointer-events-auto"
        onClick={() => map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 })}
      >
        Show everyone
      </button>
    </div>
  )
}

function ViewportInfo({ people, areaStats }: { people: Person[]; areaStats?: Record<string, AreaStats> }) {
  const [label, setLabel] = useState("Area view")
  const [count, setCount] = useState(0)
  const [zoom, setZoom] = useState(0)

  const update = useCallback((map: L.Map) => {
    const bounds = map.getBounds()
    const z = map.getZoom()
    let nextLabel = "Area view"
    let nextCount = 0

    if (areaStats) {
      const entries = Object.entries(areaStats).filter(([, stat]) => bounds.contains([stat.lat, stat.lng]))
      nextCount = entries.reduce((sum, [, stat]) => sum + stat.userCount, 0)
      if (entries.length) {
        nextLabel = entries[0][0]
      } else {
        const center = map.getCenter()
        const nearest = Object.entries(areaStats).reduce((closest, entry) => {
          const dist = center.distanceTo([entry[1].lat, entry[1].lng])
          if (!closest || dist < closest.dist) return { entry, dist }
          return closest
        }, null as null | { entry: [string, AreaStats]; dist: number })
        if (nearest) nextLabel = nearest.entry[0]
      }
    } else {
      nextCount = people.filter((p) => bounds.contains([p.latitude, p.longitude])).length
      nextLabel = nextCount ? "This view" : "Zoom closer"
    }

    setLabel(nextLabel)
    setCount(nextCount)
    setZoom(z)
  }, [areaStats, people])

  const map = useMapEvents({
    moveend() {
      update(map)
    },
    zoomend() {
      update(map)
    },
  })

  useEffect(() => {
    update(map)
  }, [map, update])

  return (
    <div className="absolute bottom-14 left-3 z-[1000] px-3 py-2 rounded-xl bg-black/70 border border-emerald-400/30 text-xs text-emerald-50 shadow-lg shadow-emerald-400/15">
      <div className="font-semibold">{label}</div>
      <div className="text-emerald-200/80">{count} in view • zoom {Math.round(zoom)}</div>
    </div>
  )
}

function createClusterIcon(userCount: number, onlineCount: number, chatCount: number) {
  const size = Math.min(60 + userCount * 3, 100)
  const intensity = Math.min(onlineCount / Math.max(userCount, 1), 1)
  const color = intensity > 0.5 ? "#22d3ee" : intensity > 0.2 ? "#06b6d4" : "#0891b2"
  
  return L.divIcon({
    className: "custom-cluster",
    html: `
      <div style="
        width: ${size}px; 
        height: ${size}px; 
        background: linear-gradient(135deg, ${color}dd, ${color}88);
        border: 3px solid white; 
        border-radius: 50%; 
        box-shadow: 0 4px 20px ${color}66;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
      " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
        <span style="font-size: ${Math.max(14, size / 4)}px; font-weight: bold; color: white; line-height: 1;">${userCount}</span>
        <span style="font-size: ${Math.max(10, size / 6)}px; color: white; opacity: 0.9;">users</span>
        ${chatCount > 0 ? `<span style="font-size: ${Math.max(8, size / 7)}px; color: white; opacity: 0.7;">${chatCount} chats</span>` : ''}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const photoIcon = L.divIcon({
  className: "custom-photo-marker",
  html: `<div style="width: 36px; height: 36px; background: linear-gradient(135deg,#f97316,#ef4444); border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 15px rgba(239,68,68,0.5); display: flex; align-items: center; justify-content: center; font-size: 18px;">📷</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const currentUserIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="width: 32px; height: 32px; background: #8b5cf6; border: 4px solid white; border-radius: 50%; box-shadow: 0 2px 12px rgba(139,92,246,0.5); animation: pulse 2s infinite;"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const searchIcon = L.divIcon({
  className: "custom-search-marker",
  html: `<div style="width: 40px; height: 40px; background: linear-gradient(135deg,#f59e0b,#ef4444); border: 4px solid white; border-radius: 50%; box-shadow: 0 4px 20px rgba(245,158,11,0.6); display: flex; align-items: center; justify-content: center; font-size: 20px; animation: bounce 1s infinite;">📍</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

function MapClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function HeatMap({ people, center, currentUserLocation, onPersonClick, areaStats, onAreaClick, onPhotoClick, onMapClick, photos = [] }: HeatMapProps) {
  const [centerLat, centerLng] = center
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)
  const [showActivityPanel, setShowActivityPanel] = useState(false)
  const memoCenter = useMemo(() => [centerLat, centerLng] as [number, number], [centerLat, centerLng])
  
  const handleSearchResult = useCallback((lat: number, lng: number, name: string) => {
    setSearchedLocation({ lat, lng, name })
    setShowActivityPanel(true)
  }, [])

  useEffect(() => {
    if (searchedLocation && !showActivityPanel) {
      const timer = setTimeout(() => {
        setSearchedLocation(null)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [searchedLocation, showActivityPanel])

  const heatPoints: [number, number, number][] = []
  const zoomLevel = areaStats && Object.keys(areaStats).length > 1 ? 4 : searchedLocation ? 13 : 13
  const totalUsers = areaStats
    ? Object.values(areaStats).reduce((sum, s) => sum + s.userCount, 0)
    : people.length
  const onlineCount = areaStats
    ? Object.values(areaStats).reduce((sum, s) => sum + s.onlineCount, 0)
    : people.filter((p) => p.is_online).length
  const vibePercent = totalUsers === 0 ? 0 : Math.round((onlineCount / totalUsers) * 100)
  const boundsPoints = useMemo(() => {
    const pts: [number, number][] = people.map((p) => [p.latitude, p.longitude])
    if (currentUserLocation) pts.push(currentUserLocation)
    return pts
  }, [people, currentUserLocation])

  if (areaStats) {
    Object.values(areaStats).forEach((stat) => {
      for (let i = 0; i < stat.userCount; i++) {
        heatPoints.push([
          stat.lat + (Math.random() - 0.5) * 0.02,
          stat.lng + (Math.random() - 0.5) * 0.02,
          stat.onlineCount / Math.max(stat.userCount, 1),
        ])
      }
    })
  } else {
    people.forEach((p) => {
      heatPoints.push([p.latitude, p.longitude, p.is_online ? 1.0 : 0.45])
    })
  }

  if (currentUserLocation) {
    heatPoints.push([currentUserLocation[0], currentUserLocation[1], 1.0])
  }

  const userIcon = L.divIcon({
    className: "custom-marker",
    html: `<div style="width: 28px; height: 28px; background: linear-gradient(135deg,#22d3ee,#a855f7); border: 3px solid white; border-radius: 50%; box-shadow: 0 6px 18px rgba(34,211,238,0.45); position: relative;"><div style=\"position:absolute; inset:-6px; border-radius:50%; background: radial-gradient(circle, rgba(34,211,238,0.28), transparent 60%); filter: blur(6px);\"></div></div>` ,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0 rounded-2xl pointer-events-none mix-blend-screen" style={{ background: "radial-gradient(circle at 20% 20%, rgba(34,211,238,0.14), transparent 35%), radial-gradient(circle at 80% 25%, rgba(168,85,247,0.16), transparent 38%), radial-gradient(circle at 40% 80%, rgba(34,197,94,0.12), transparent 40%)" }} />
      
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap gap-2 text-xs">
        <div className="px-3 py-2 rounded-xl bg-black/70 border border-cyan-500/40 shadow-lg shadow-cyan-500/20">
          <div className="text-cyan-100 font-semibold">{totalUsers} nearby</div>
          <div className="text-cyan-300/80">all users visible</div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-black/60 border border-fuchsia-500/40 shadow-lg shadow-fuchsia-500/20">
          <span className="text-fuchsia-100 font-semibold">{vibePercent}% vibing</span>
          <span className="ml-2 text-fuchsia-200/80">{onlineCount} online</span>
        </div>
        {photos.length > 0 && (
          <div className="px-3 py-2 rounded-xl bg-black/60 border border-orange-500/40 shadow-lg shadow-orange-500/20">
            <span className="text-orange-100 font-semibold">📷 {photos.length} photos</span>
          </div>
        )}
      </div>

      <MapContainer
        center={searchedLocation ? [searchedLocation.lat, searchedLocation.lng] : memoCenter}
        zoom={zoomLevel}
        minZoom={2}
        className="w-full h-full rounded-2xl overflow-hidden border border-white/5 shadow-[0_20px_80px_rgba(14,165,233,0.15)]"
        style={{ minHeight: "400px" }}
      >
        <SearchBar onSearchResult={handleSearchResult} />
        <ViewportInfo people={people} areaStats={areaStats} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        />
        <Recenter centerLat={searchedLocation?.lat || centerLat} centerLng={searchedLocation?.lng || centerLng} zoom={zoomLevel} />
        <HeatLayer points={heatPoints} />
        <FitAllControl points={boundsPoints} />
        <MapClickHandler onClick={onMapClick} />
        
        {searchedLocation && (
          <Marker position={[searchedLocation.lat, searchedLocation.lng]} icon={searchIcon}>
            <Popup>
              <div className="text-center p-2">
                <strong className="text-base">{searchedLocation.name}</strong>
                <p className="text-xs text-gray-500 mt-1">Searched location</p>
              </div>
            </Popup>
          </Marker>
        )}

        {currentUserLocation && (
          <Marker position={currentUserLocation} icon={currentUserIcon}>
            <Popup>
              <div className="text-center">
                <strong>You are here</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {photos.map((photo) => (
          <Marker
            key={photo.id}
            position={[photo.latitude, photo.longitude]}
            icon={photoIcon}
            eventHandlers={{
              click: () => onPhotoClick?.(photo.latitude, photo.longitude),
            }}
          >
            <Popup>
              <div className="text-center p-2 min-w-[180px]">
                <img 
                  src={photo.photo_url} 
                  alt={photo.caption || "Location photo"} 
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
                {photo.caption && (
                  <p className="text-sm mb-2">{photo.caption}</p>
                )}
                <p className="text-xs text-gray-500">by {photo.user.display_name || photo.user.username}</p>
                <button
                  className="mt-2 w-full px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                  onClick={() => onPhotoClick?.(photo.latitude, photo.longitude)}
                >
                  📷 View All Photos Here
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {areaStats && Object.entries(areaStats).map(([cityName, stats]) => (
          <Marker
            key={cityName}
            position={[stats.lat, stats.lng]}
            icon={createClusterIcon(stats.userCount, stats.onlineCount, stats.chatCount)}
            eventHandlers={{
              click: () => onAreaClick?.(cityName, stats),
            }}
          >
            <Popup>
              <div className="text-center p-2 min-w-[150px]">
                <strong className="text-lg">{cityName}</strong>
                <div className="mt-2 space-y-1 text-sm">
                  <p><span className="text-cyan-500 font-semibold">{stats.userCount}</span> total users</p>
                  <p><span className="text-green-500 font-semibold">{stats.onlineCount}</span> online now</p>
                  <p><span className="text-orange-500 font-semibold">{stats.chatCount}</span> active chats</p>
                </div>
                {stats.chats.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Top Chats:</p>
                    {stats.chats.slice(0, 3).map((chat) => (
                      <p key={chat.id} className="text-xs">
                        {chat.name} ({chat.messageCount} msgs)
                      </p>
                    ))}
                  </div>
                )}
                <button 
                  className="mt-3 px-3 py-1 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"
                  onClick={() => onAreaClick?.(cityName, stats)}
                >
                  Join Chat
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {!areaStats && people.map((person) => (
          <Marker
            key={person.id}
            position={[person.latitude, person.longitude]}
            icon={userIcon}
            eventHandlers={{
              click: () => onPersonClick?.(person),
            }}
          >
            <Popup>
              <div className="text-center p-2">
                <strong className="text-base">{person.display_name || person.username}</strong>
                <br />
                <span className="text-sm mt-1 inline-block">
                  {person.is_online ? "🟢 Online" : "⚫ Offline"}
                </span>
                <button
                  className="mt-3 w-full px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"
                  onClick={() => onPhotoClick?.(person.latitude, person.longitude)}
                >
                  📷 View Photos Here
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {showActivityPanel && searchedLocation && (
        <ActivityPanel
          lat={searchedLocation.lat}
          lng={searchedLocation.lng}
          locationName={searchedLocation.name}
          onClose={() => {
            setShowActivityPanel(false)
            setSearchedLocation(null)
          }}
        />
      )}

      <div className="absolute bottom-3 right-3 z-[1000] px-3 py-2 rounded-xl bg-black/65 border border-emerald-400/30 text-xs text-emerald-50 shadow-lg shadow-emerald-400/15">
        <div className="font-semibold">Live heat • updated</div>
        <div className="text-emerald-200/80">Click map to add photo</div>
      </div>
    </div>
  )
}