"use client"

import { useEffect, useState, useRef, Suspense, useMemo } from "react"
import { Capacitor } from "@capacitor/core"
import { Geolocation } from "@capacitor/geolocation"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Profile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Save, Loader2, MapPin, Settings, Users, MessageCircle, LogOut, WifiOff } from "lucide-react"

function loadCachedProfile() {
  if (typeof window === "undefined") return null
  try {
    const cached = localStorage.getItem('tapin:profile')
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

function SettingsContent() {
  const initialProfile = useMemo(() => loadCachedProfile(), [])
  
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState(initialProfile?.display_name || "")
  const [username, setUsername] = useState(initialProfile?.username || "")
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar_url || "")
  const [linkedin, setLinkedin] = useState(initialProfile?.linkedin_url || "")
  const [city, setCity] = useState(initialProfile?.city || "")
  const [latitude, setLatitude] = useState<number | null>(initialProfile?.latitude || null)
  const [longitude, setLongitude] = useState<number | null>(initialProfile?.longitude || null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [watchingLocation, setWatchingLocation] = useState(false)
  const watchIdRef = useRef<string | number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const platform = Capacitor.getPlatform()
  const isNative = platform !== "web"

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        router.push("/login")
        return
      }

      if (!isOnline && initialProfile) {
        setLoading(false)
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setDisplayName(profileData.display_name || "")
        setUsername(profileData.username || "")
        setAvatarUrl(profileData.avatar_url || "")
        setCity(profileData.city || "")
        setLatitude(profileData.latitude)
        setLongitude(profileData.longitude)
        setLinkedin(profileData.linkedin_url || "")
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('tapin:profile', JSON.stringify(profileData))
        }
      }

      setLoading(false)
    }

    getProfile()
  }, [supabase, router, isOnline, initialProfile])

  // Retry pending updates when back online
  useEffect(() => {
    if (!isOnline || !profile) return

    const retryPending = async () => {
      try {
        const pending = localStorage.getItem('tapin:pending-profile')
        if (!pending) return

        const updates = JSON.parse(pending)
        await supabase
          .from("profiles")
          .update(updates)
          .eq("id", profile.id)

        localStorage.removeItem('tapin:pending-profile')
        setMessage({ type: "success", text: "Changes synced!" })
      } catch {}
    }

    retryPending()
  }, [isOnline, profile, supabase])

  useEffect(() => {
    if (!profile?.latitude || !profile?.longitude) return

    setWatchingLocation(true)

    const startWatching = async () => {
      try {
        if (isNative) {
          const status = await Geolocation.checkPermissions()
          if (status.location !== "granted") {
            setWatchingLocation(false)
            return
          }

          const watchId = await Geolocation.watchPosition(
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            },
            (position, err) => {
              if (position) {
                setLatitude(position.coords.latitude)
                setLongitude(position.coords.longitude)
              }
            }
          )
          watchIdRef.current = watchId
        } else {
          if (!navigator.geolocation) {
            setWatchingLocation(false)
            return
          }

          const watchId = navigator.geolocation.watchPosition(
            (position) => {
              setLatitude(position.coords.latitude)
              setLongitude(position.coords.longitude)
            },
            undefined,
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            }
          )
          watchIdRef.current = watchId
        }
      } catch {
        setWatchingLocation(false)
      }
    }

    startWatching()

    return () => {
      if (watchIdRef.current !== null) {
        if (isNative) {
          Geolocation.clearWatch({ id: watchIdRef.current as string })
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current as number)
        }
      }
    }
  }, [profile?.latitude, profile?.longitude, isNative])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !profile) return

    setUploading(true)
    setMessage(null)

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image too large (max 5MB)" })
      setUploading(false)
      return
    }

    const fileExt = file.name.split(".").pop()
    const fileName = `${profile.id}-${Date.now()}.${fileExt}`
    const filePath = `${profile.id}/${fileName}`

    try {
      const { data, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type || undefined })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(data?.path || filePath)

      setAvatarUrl(publicUrl)
      
      const updatedProfile = { ...profile, avatar_url: publicUrl }
      setProfile(updatedProfile)
      localStorage.setItem('tapin:profile', JSON.stringify(updatedProfile))
      
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id)
      
      setMessage({ type: "success", text: "Profile photo updated" })
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to upload image" })
    } finally {
      setUploading(false)
    }
  }

  const handleGetLocation = async () => {
    if (!profile) return
    
    setLocating(true)
    setMessage(null)

    try {
      let lat: number
      let lng: number

      if (isNative) {
        const status = await Geolocation.checkPermissions()
        if (status.location !== "granted") {
          const requested = await Geolocation.requestPermissions({ permissions: ["location"] })
          if (requested.location !== "granted") {
            throw new Error("denied")
          }
        }
        const position = await Geolocation.getCurrentPosition({ 
          enableHighAccuracy: true, 
          timeout: 5000,
          maximumAge: 10000 
        })
        lat = position.coords.latitude
        lng = position.coords.longitude
      } else {
        if (!navigator.geolocation) {
          throw new Error("unsupported")
        }
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            enableHighAccuracy: true, 
            timeout: 5000,
            maximumAge: 10000 
          })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      }

      setLatitude(lat)
      setLongitude(lng)

      const locationUpdate = {
        latitude: lat,
        longitude: lng,
        location_updated_at: new Date().toISOString()
      }

      const updatedProfile = { ...profile, ...locationUpdate }
      setProfile(updatedProfile)
      localStorage.setItem('tapin:profile', JSON.stringify(updatedProfile))

      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current)
      }

      geocodeTimeoutRef.current = setTimeout(async () => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 2000)
          
          const response = await fetch(
            `/api/geocode?lat=${lat}&lng=${lng}`,
            { signal: controller.signal }
          )
          
          clearTimeout(timeoutId)
          
          if (response.ok) {
            const data = await response.json()
            const locationName = data.name || data.city || city
            setCity(locationName)
            
            const withCity = { ...updatedProfile, city: locationName }
            setProfile(withCity)
            localStorage.setItem('tapin:profile', JSON.stringify(withCity))
          }
        } catch {}
      }, 500)

      if (!isOnline) {
        localStorage.setItem('tapin:pending-profile', JSON.stringify(locationUpdate))
        setMessage({ type: "success", text: "Location saved locally" })
      } else {
        const { error } = await supabase
          .from("profiles")
          .update(locationUpdate)
          .eq("id", profile.id)

        if (error) {
          setMessage({ type: "error", text: "Failed to save location" })
        } else {
          setMessage({ type: "success", text: "Location updated!" })
        }
      }
    } catch (err: any) {
      if (err.message === "denied") {
        setMessage({ type: "error", text: "Location permission denied" })
      } else if (err.code === 3) {
        setMessage({ type: "error", text: "Location timeout - try again" })
      } else {
        setMessage({ type: "error", text: "Could not get location" })
      }
    } finally {
      setLocating(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return

    setSaving(true)
    setMessage(null)

    const cleanLinkedIn = linkedin.trim()
    const normalizedLinkedIn = cleanLinkedIn ? (cleanLinkedIn.startsWith("http") ? cleanLinkedIn : `https://${cleanLinkedIn}`) : null

    const updates = {
      display_name: displayName,
      username: username,
      avatar_url: avatarUrl,
      city: city,
      latitude: latitude,
      longitude: longitude,
      linkedin_url: normalizedLinkedIn,
      location_updated_at: latitude && longitude ? new Date().toISOString() : profile.location_updated_at,
    }

    const updatedProfile = { ...profile, ...updates }
    setProfile(updatedProfile)
    localStorage.setItem('tapin:profile', JSON.stringify(updatedProfile))

    if (!isOnline) {
      localStorage.setItem('tapin:pending-profile', JSON.stringify(updates))
      setMessage({ type: "success", text: "Saved locally. Will sync when online." })
      setSaving(false)
      return
    }

    if (username !== profile.username) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", profile.id)
        .single()

      if (existing) {
        setMessage({ type: "error", text: "Username already taken" })
        setSaving(false)
        return
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id)

    if (error) {
      setMessage({ type: "error", text: "Failed to save changes" })
    } else {
      setMessage({ type: "success", text: "Saved!" })
    }

    setSaving(false)
  }

  const handleSignOut = async () => {
    if (profile) {
      await supabase
        .from("profiles")
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq("id", profile.id)
    }
    await supabase.auth.signOut()
    router.push("/login")
  }

  const showSkeleton = loading && !profile

  return (
    <div className="min-h-screen flex flex-col bg-background pb-20">
      <header className="sticky top-0 z-50 glass border-b border-border/50 safe-top safe-horizontal">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-cyan-400" />
            <span className="text-xl font-bold">Settings</span>
          </div>
          {!isOnline && (
            <div className="flex items-center gap-1 text-xs text-amber-500">
              <WifiOff className="w-4 h-4" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 safe-horizontal">
        <div className="glass rounded-2xl p-6 border border-border/50">
          <div className="flex flex-col items-center mb-6">
            {showSkeleton ? (
              <div className="w-20 h-20 rounded-full bg-secondary/60 animate-pulse" />
            ) : (
              <div className="relative mb-3">
                <Avatar className="w-20 h-20 ring-2 ring-cyan-500/30">
                  <AvatarImage src={avatarUrl || ""} />
                  <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-xl">
                    {username[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || loading || !profile}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-cyan-500 rounded-full flex items-center justify-center text-white hover:bg-cyan-600 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Display Name</label>
              {showSkeleton ? (
                <div className="h-11 rounded-xl bg-secondary/60 animate-pulse" />
              ) : (
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="bg-secondary/50 border-border/50 rounded-xl h-11"
                  disabled={loading}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Username</label>
              {showSkeleton ? (
                <div className="h-11 rounded-xl bg-secondary/60 animate-pulse" />
              ) : (
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="username"
                  className="bg-secondary/50 border-border/50 rounded-xl h-11"
                  disabled={loading}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">LinkedIn</label>
              {showSkeleton ? (
                <div className="h-11 rounded-xl bg-secondary/60 animate-pulse" />
              ) : (
                <Input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://www.linkedin.com/in/your-handle"
                  className="bg-secondary/50 border-border/50 rounded-xl h-11"
                  disabled={loading}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              {showSkeleton ? (
                <div className="flex gap-2">
                  <div className="h-11 flex-1 rounded-xl bg-secondary/60 animate-pulse" />
                  <div className="h-11 w-11 rounded-xl bg-secondary/60 animate-pulse" />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Your street or location"
                    className="bg-secondary/50 border-border/50 rounded-xl flex-1 h-11"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGetLocation}
                    disabled={locating || loading}
                    className="rounded-xl h-11 w-11"
                  >
                    {locating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {message && (
              <p className={`text-sm ${message.type === "success" ? "text-green-500" : "text-red-500"}`}>
                {message.text}
              </p>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || loading || !username.trim()}
              className="w-full rounded-xl h-11 bg-cyan-500 hover:bg-cyan-600"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>

            <Button
              onClick={handleSignOut}
              variant="outline"
              disabled={loading}
              className="w-full rounded-xl h-11"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 z-50">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-around">
          <Link href="/app" className="flex flex-col items-center gap-1 py-2 px-6">
            <MapPin className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Nearby</span>
          </Link>
          <Link href="/app/people" className="flex flex-col items-center gap-1 py-2 px-6">
            <Users className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Friends</span>
          </Link>
          <Link href="/app/chats" className="flex flex-col items-center gap-1 py-2 px-6">
            <MessageCircle className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Chats</span>
          </Link>
          <div className="flex flex-col items-center gap-1 py-2 px-6">
            <Settings className="w-6 h-6 text-cyan-400" />
            <span className="text-xs text-cyan-400 font-medium">Settings</span>
          </div>
        </div>
      </nav>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}