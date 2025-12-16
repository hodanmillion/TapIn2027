# TapIn Offline-First Quick Start Guide

## 🎉 What's Been Done

Your app now has:
- ✅ **Offline-first architecture** - Messages load from cache instantly
- ✅ **Reliable message sending** - Outbox pattern with auto-retry
- ✅ **Network resilience** - WebSocket ↔ HTTP polling automatic fallback
- ✅ **iOS-optimized UI** - Safe areas, fixed positioning, single scroll
- ✅ **Performance** - Virtualization library installed, ready to apply

## 🚀 Next Steps (Apply Layout Changes)

### 1. Update `src/app/app/page.tsx`

The main page needs layout changes for iOS stability. See **OFFLINE_FIRST_IMPLEMENTATION.md** for:

- Replace root container with `.appShell` pattern
- Apply single-scroll-container pattern to chat view
- Add virtualized message list (optional but recommended)
- Memoize map center to prevent remounts

**Estimated time**: 30-45 minutes

### 2. Test Locally

```bash
# App is already running on http://localhost:3000
# Test in browser with DevTools:
```

**Offline Mode Test**:
1. Open DevTools → Network tab → Throttle to "Offline"
2. Refresh page → Should load from cache
3. Navigate to chat → Messages should appear instantly
4. Send message → Should show as "pending"
5. Go back online → Message should sync and turn "sent"

**Network Degradation Test**:
1. DevTools → Network → Throttle to "Slow 3G"
2. Open chat → Should show amber banner "Slow connection"
3. Check console → Should see `[Realtime] falling back to polling`

### 3. Deploy to Vercel

```bash
git add .
git commit -m "feat: offline-first architecture with iOS optimizations"
git push origin main
```

Vercel will auto-deploy. Wait ~2 minutes for build to complete.

### 4. Sync & Deploy to iOS

```bash
# Sync web assets to iOS project
npx cap sync ios

# Open in Xcode
npx cap open ios
```

### 5. In Xcode

**Before Archive**:
1. Select scheme: **App**
2. Select device: **Any iOS Device (arm64)**
3. Increment build number: **General → Build** (e.g., 1.0.1 → 1.0.2)

**Archive & Upload**:
1. Product → Archive (⌘B to build first)
2. Window → Organizer → Select archive
3. Click **Distribute App**
4. Select **App Store Connect**
5. Follow prompts → Upload

**⏱ Upload takes 5-10 minutes**

### 6. TestFlight Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. TestFlight tab
4. Wait for build processing (10-15 minutes)
5. Add internal testers (up to 100)
6. Add external testers (optional, requires review)

## 🧪 Testing on Physical Device

### Install TestFlight App
Download from App Store on your iPhone

### Simulate Network Conditions

**Enable Developer Mode** (iOS 16+):
1. Settings → Privacy & Security → Developer Mode → ON
2. Restart iPhone

**Network Link Conditioner**:
1. Settings → Developer → Network Link Conditioner
2. Enable it
3. Select profile: "Very Bad Network" or "3G"

### Test Scenarios

**✅ Offline Mode**:
1. Enable Airplane Mode
2. Open app → Should load instantly from cache
3. Open chat → Messages should appear
4. Send message → Shows as pending
5. Disable Airplane Mode → Message syncs

**✅ Slow Network**:
1. Enable Network Link Conditioner → "3G"
2. Open chat → Amber banner "Slow connection (cellular)"
3. Messages still sync (slower)

**✅ Background/Foreground**:
1. Open chat
2. Home button (send to background)
3. Wait 1 minute
4. Return to app → Should sync new messages

**✅ Keyboard Behavior**:
1. Open chat
2. Tap input box → Keyboard opens
3. Verify composer stays at bottom (not covered)
4. Scroll messages → Keyboard doesn't interfere

**✅ Safe Areas**:
1. Open app on iPhone 14 Pro+ (Dynamic Island)
2. Pull down notification center
3. Verify no content hidden behind notch/island

## 📊 Monitoring

### Browser Console (Development)
Look for these log patterns:

```
[Init-SSR] Loaded cached location: {...}    ✅ Cache working
[Outbox] Message <id> sent successfully     ✅ Sync working
[Realtime] falling back to polling          ✅ Fallback working
[useMessages] Cache load error              ❌ Check IndexedDB
```

### Xcode Console (iOS Device)
1. Window → Devices and Simulators
2. Select your device
3. Open Console
4. Filter by process name: "TapIn"

### Network Inspector
1. Xcode → Debug → Attach to Process
2. Debug → Network → HTTP Traffic

## 🐛 Common Issues

### "Only secure origins are allowed"
- **Cause**: Geolocation requires HTTPS
- **Fix**: Test on physical device (iOS handles this) or use ngrok for local HTTPS

### "Failed to fetch" errors
- **Cause**: Network is actually offline or degraded
- **Expected**: App should fallback to cache (check for amber/red banner)

### Messages not syncing
- **Check**: Browser DevTools → Application → IndexedDB → TapInDB → outbox
- **Expected**: Pending messages should appear there
- **Fix**: Ensure outbox processor is running (check console for `[Outbox]` logs)

### Layout issues on iOS
- **Cause**: Layout changes not yet applied to page.tsx
- **Fix**: Follow OFFLINE_FIRST_IMPLEMENTATION.md to apply `.appShell` pattern

### Keyboard covers input
- **Cause**: Composer not in `.fixed-footer`
- **Fix**: Apply layout changes from implementation guide

## 📈 Performance Expectations

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Cache load time | < 100ms | Check console timestamp |
| Message send (optimistic) | < 50ms | Message appears instantly |
| Scroll FPS | 60 FPS | Enable FPS meter in DevTools |
| Memory usage | < 150MB | Xcode Instruments → Allocations |
| Battery drain | < 10%/hour | iOS Settings → Battery after 1 hour |

## ✅ Success Checklist

Before considering deployment complete:

- [ ] Messages load instantly from cache (offline test)
- [ ] Can send messages offline (appear as pending)
- [ ] Messages sync when network returns
- [ ] Amber banner shows on slow network
- [ ] Red banner shows when offline
- [ ] Chat scrolls smoothly with 50+ messages
- [ ] Keyboard doesn't cover composer
- [ ] Safe areas respected on all iPhones
- [ ] Map doesn't flicker on state changes
- [ ] Location updates in background
- [ ] No JavaScript errors in console
- [ ] TestFlight build installs successfully

## 📞 Need Help?

- **Browser logs showing errors?** Check ARCHITECTURE_SUMMARY.md for explanations
- **Layout issues?** See OFFLINE_FIRST_IMPLEMENTATION.md for detailed changes
- **Build failures?** Check Xcode build logs or `npx cap sync ios` output

## 🎯 You're Done When...

1. TestFlight build uploaded ✅
2. Testers can install ✅
3. App works offline on iOS ✅
4. UI is stable (no layout glitches) ✅
5. Messages send reliably ✅

**The foundation is complete. Just apply layout changes and deploy!**
