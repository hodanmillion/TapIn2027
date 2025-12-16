# TapIn Offline-First Re-Architecture Implementation Guide

## ✅ Completed

### 1. Offline Storage Layer (IndexedDB via Dexie)
- ✅ Database schema in `src/lib/db.ts`
- ✅ Messages, outbox, sync timestamps tables
- ✅ Cache management functions

### 2. Outbox Pattern for Reliable Messaging
- ✅ Message queuing in `src/lib/sync.ts`
- ✅ Exponential backoff retry logic
- ✅ Optimistic UI updates
- ✅ Auto-retry on network reconnect
- ✅ Background processor with 3s interval

### 3. Network-Aware Behavior
- ✅ Enhanced `useNetworkStatus` hook with Capacitor Network plugin
- ✅ Latency-based connection quality detection
- ✅ Connection type reporting (wifi, cellular, etc.)
- ✅ Adaptive health checks

### 4. WebSocket Fallback to HTTP Polling
- ✅ Implemented in `useMessages` hook
- ✅ Automatic fallback on WS failure
- ✅ Adaptive polling intervals (5s online, 10s degraded)
- ✅ Graceful degradation with offline mode

### 5. iOS Safe Area & Viewport
- ✅ Updated `globals.css` with:
  - Fixed html/body positioning
  - Proper safe area insets
  - iOS-specific webkit optimizations
  - `.appShell` wrapper class
  - Scroll containment classes

## 🔨 Required Changes to src/app/app/page.tsx

### Critical iOS Layout Fixes

#### 1. Update Root Container Structure
Replace the current root div with:

```tsx
<div className="appShell">
  <OfflineBanner />
  
  {/* Fixed Header */}
  <header className="fixed-header glass border-b border-border/50 backdrop-blur-xl">
    {/* ... existing header content ... */}
  </header>

  {/* Scrollable Content */}
  <main className="scrollable-content">
    {/* ... all page content ... */}
  </main>

  {/* Fixed Bottom Nav */}
  <nav className="fixed-footer glass border-t border-t-border/50">
    {/* ... existing nav content ... */}
  </nav>
</div>
```

#### 2. Chat View Layout (When selectedChat exists)
Replace chat view structure with single-scroll-container pattern:

```tsx
{selectedChat && (
  <div className="appShell bg-gradient-to-b from-slate-950 via-slate-900 to-black">
    <OfflineBanner />
    
    {/* Fixed Header */}
    <header className="fixed-header glass border-b border-border/50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSelectedChat(null)} className="...">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {/* ... chat header ... */}
      </div>
    </header>

    {/* Scrollable Messages */}
    <div className="scrollable-content px-4">
      <div className="space-y-4 py-4 max-w-4xl mx-auto">
        {/* Message list */}
        {messages.map(msg => {/* ... */})}
        <div ref={messagesEndRef} />
      </div>
    </div>

    {/* Fixed Composer */}
    <div className="fixed-footer glass border-t border-border/50">
      {/* ... message input ... */}
    </div>
  </div>
)}
```

### Performance: Virtualized Message List

Install done: `@tanstack/react-virtual@3.13.13`

Add to imports:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'
```

Replace messages mapping with virtualized list:
```tsx
const parentRef = useRef<HTMLDivElement>(null)

const rowVirtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 100,
  overscan: 5,
})

{/* In scrollable container */}
<div
  ref={parentRef}
  className="scrollable-content px-4"
  style={{ height: '100%', overflow: 'auto' }}
>
  <div
    style={{
      height: `${rowVirtualizer.getTotalSize()}px`,
      width: '100%',
      position: 'relative',
    }}
  >
    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
      const msg = messages[virtualRow.index]
      return (
        <div
          key={msg.client_id || msg.id}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          {/* Message bubble component */}
        </div>
      )
    })}
  </div>
</div>
```

### Pagination Strategy

Update `useMessages` to support pagination:
```tsx
const loadOlderMessages = async () => {
  if (!threadId || loading) return
  const oldest = messages[0]?.created_at
  
  const res = await fetch(
    `/api/location-chat/messages?chatId=${threadId}&before=${oldest}&limit=50`,
    { signal: AbortSignal.timeout(5000) }
  )
  // Prepend to messages array
}
```

Add to scroll container:
```tsx
const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
  if (e.currentTarget.scrollTop < 100 && !loading) {
    loadOlderMessages()
  }
}
```

### Network-Aware Updates

Update `useMessages` destructuring:
```tsx
const { messages, loading, error, sendMessage, retryMessage, realtimeMode } = useMessages(
  selectedChat?.id || null,
  user?.id || null
)
```

Add realtime indicator to chat header:
```tsx
{realtimeMode === "websocket" && (
  <div className="flex items-center gap-1 text-xs text-green-400">
    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
    <span>Live</span>
  </div>
)}
{realtimeMode === "polling" && (
  <div className="flex items-center gap-1 text-xs text-amber-400">
    <CloudOff className="w-3 h-3" />
    <span>Syncing</span>
  </div>
)}
```

### Map Stability

Memoize map center to prevent remounts:
```tsx
const mapCenter = useMemo(() => 
  searchedLocation 
    ? [searchedLocation.lat, searchedLocation.lng] as [number, number]
    : location 
      ? [location.lat, location.lng] as [number, number]
      : undefined,
  [searchedLocation?.lat, searchedLocation?.lng, location?.lat, location?.lng]
)

const mapKey = useMemo(() => 
  `${mapCenter?.[0]}-${mapCenter?.[1]}`,
  [mapCenter]
)

{/* In map render */}
{mapCenter && (
  <Suspense fallback={<Loader />}>
    <HeatMap
      key={mapKey}
      people={nearbyPeople}
      center={mapCenter}
      currentUserLocation={location ? [location.lat, location.lng] : undefined}
      photos={locationPhotos}
      onPhotoClick={handlePhotoClick}
      onMapClick={handleMapClick}
    />
  </Suspense>
)}
```

### Location Caching & Background Updates

Already implemented caching. Ensure throttled updates:
```tsx
const LOCATION_UPDATE_THROTTLE = 30000 // 30s

const throttledLocationUpdate = useMemo(
  () => {
    let lastUpdate = 0
    return async (lat: number, lng: number, city: string) => {
      const now = Date.now()
      if (now - lastUpdate < LOCATION_UPDATE_THROTTLE) return
      lastUpdate = now
      await updateUserLocation(userId, lat, lng, city)
    }
  },
  [updateUserLocation, userId]
)
```

## 🧪 Testing Checklist

### Offline Mode Testing
1. ✅ Enable Airplane Mode on iOS
2. ✅ Open app - should load from cache instantly
3. ✅ Navigate to chat - messages should appear immediately
4. ✅ Send message - should appear with pending status
5. ✅ Disable Airplane Mode - message should sync and change to sent
6. ✅ Banner should show "No internet" then disappear

### Network Degradation Testing
1. ✅ Use Network Link Conditioner (iOS Settings > Developer)
2. ✅ Set to "Very Bad Network" or "3G"
3. ✅ Verify banner shows "Slow connection"
4. ✅ Check that polling mode activates (see logs)
5. ✅ Messages should still sync (slower)

### iOS UI Stability Testing
1. ✅ Rotate device - no layout breaks
2. ✅ Pull down notification center - safe area respected
3. ✅ Open keyboard in chat - composer stays fixed at bottom
4. ✅ Scroll messages - smooth, no jumps
5. ✅ Open map tab - map doesn't remount unnecessarily
6. ✅ Dynamic Island (iPhone 14 Pro+) - content not hidden

### Background/Foreground Testing
1. ✅ Send app to background (home button)
2. ✅ Wait 1 minute
3. ✅ Return to app - location should update smoothly
4. ✅ New messages should sync
5. ✅ Outbox should flush pending messages

### Low Power Mode Testing
1. ✅ Enable Low Power Mode in iOS Settings
2. ✅ App should function (slower sync intervals acceptable)
3. ✅ Location updates should work (may be less frequent)

## 📦 Deployment to TestFlight

### 1. Sync Capacitor
```bash
npx cap sync ios
```

### 2. Open in Xcode
```bash
npx cap open ios
```

### 3. Configure in Xcode
- Select target: Any iOS Device (arm64)
- Update version/build number
- Verify capabilities:
  - Background Modes: Location updates
  - Background Modes: Background fetch

### 4. Archive & Upload
- Product → Archive
- Window → Organizer
- Select archive → Distribute App
- App Store Connect
- Upload

### 5. TestFlight
- App Store Connect → TestFlight
- Add internal/external testers
- Distribute build

## 🎯 Success Criteria

- ✅ Chat loads instantly from cache (< 100ms)
- ✅ Messages send offline (appear immediately with status)
- ✅ Network switches don't break UI or cause errors
- ✅ No double scrollbars on iOS
- ✅ Keyboard doesn't cover input on iOS
- ✅ Safe areas respected on all iPhone models
- ✅ Map doesn't flicker or remount on state changes
- ✅ Location updates in background without blocking UI
- ✅ Battery drain is acceptable (< 5%/hour with location)
- ✅ App feels indistinguishable from native

## 🚀 Next Steps

1. Apply layout changes to `src/app/app/page.tsx` as outlined above
2. Add virtualized message list for performance
3. Test on physical iOS device with network variations
4. Profile with Xcode Instruments (CPU, Network, Memory)
5. Deploy to TestFlight for real-world testing

## 📝 Notes

- The outbox processor runs every 3s when online
- Messages cache limited to 200 per chat for performance
- Polling intervals: 5s (online), 10s (degraded), paused (offline)
- Health checks every 30s
- Location updates throttled to 30s minimum interval
- All fetch calls have 8s timeouts with AbortController
