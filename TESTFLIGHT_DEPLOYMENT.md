# TapIn TestFlight Deployment Guide

Your app is configured to load from **`https://tap-in2026-jj45.vercel.app`** in production mode.

## ✅ Current Configuration

- **App ID**: `com.TapIn.myapp`
- **App Name**: TapIn
- **Production URL**: `https://tap-in2026-jj45.vercel.app`
- **Next.js**: Configured for dynamic routes (API routes enabled)

## 📋 Prerequisites

1. **Apple Developer Account** ($99/year)
2. **Xcode** installed (latest version recommended)
3. **App Store Connect** account access
4. **Vercel deployment** is live and working

## 🚀 Step-by-Step Deployment

### Step 1: Verify Vercel Deployment

Your app should be live at: **https://tap-in2026-jj45.vercel.app**

Test these endpoints:
```bash
# Health check
curl https://tap-in2026-jj45.vercel.app/api/health

# Should return location data
curl "https://tap-in2026-jj45.vercel.app/api/geocode?lat=40.7128&lng=-74.0060"
```

✅ If both return valid responses, your backend is ready.

---

### Step 2: Sync Capacitor iOS Project

```bash
cd /path/to/orchids-connect-app
npx cap sync ios
```

This copies your web assets and updates native plugins.

---

### Step 3: Open Xcode

```bash
npx cap open ios
```

This opens the iOS project in Xcode.

---

### Step 4: Configure App Signing in Xcode

1. **Select the "App" target** in the left sidebar
2. **Go to "Signing & Capabilities" tab**
3. **Configure Team & Bundle ID**:
   - **Team**: Select your Apple Developer account
   - **Bundle Identifier**: Keep `com.TapIn.myapp` (or change if needed)
   - ✅ Xcode should auto-provision a certificate

**Important**: If you see signing errors:
- Make sure you're logged into your Apple Developer account in Xcode
- Go to Xcode → Preferences → Accounts → Add your Apple ID
- Let Xcode automatically manage signing

---

### Step 5: Set Version & Build Number

1. In Xcode, select the **App target**
2. Go to **General** tab
3. Set:
   - **Version**: `1.0.0` (or your version)
   - **Build**: `1` (increment for each upload)

**Note**: Each TestFlight upload requires a unique build number.

---

### Step 6: Select Build Target

1. At the top of Xcode, click the device selector dropdown
2. Select **"Any iOS Device (arm64)"**

⚠️ Do NOT select a simulator - TestFlight requires a real device build.

---

### Step 7: Archive the App

1. Go to **Product → Archive** in Xcode menu
2. Wait 2-5 minutes for the build to complete
3. The **Organizer window** will open automatically

---

### Step 8: Distribute to TestFlight

In the Organizer window:

1. Click **"Distribute App"**
2. Choose **"App Store Connect"**
3. Choose **"Upload"**
4. Select your signing options:
   - ✅ Automatically manage signing (recommended)
   - ✅ Upload your app's symbols
5. Click **"Upload"**
6. Wait 5-10 minutes for processing

---

### Step 9: Configure TestFlight in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **"My Apps"**
3. Find **TapIn** (or create a new app if first time)
4. Go to **TestFlight** tab
5. Wait for the build to appear (processing takes 5-15 minutes)

**First Time Setup**:
- Fill in **Export Compliance** information (usually "No" for most apps)
- Add **Beta App Description**
- Upload **Beta App Icon** if not already set

---

### Step 10: Add Testers

Two options:

#### Internal Testing (Apple Developer team members)
1. Click **"Internal Testing"** in left sidebar
2. Click **"+"** to add testers
3. Select testers from your team
4. Testers receive email invite instantly

#### External Testing (Public beta)
1. Click **"External Testing"** in left sidebar
2. Create a new group
3. Add testers by email
4. **First external build requires Apple review** (1-2 days)

---

### Step 11: Install TestFlight on iPhone

1. Install **TestFlight app** from App Store
2. Open invite email on iPhone
3. Tap **"View in TestFlight"**
4. Tap **"Install"**
5. Open **TapIn** from home screen

---

## 🧪 Testing Checklist

Once installed on TestFlight, verify:

- ✅ App loads the Vercel URL correctly
- ✅ Location permission request appears
- ✅ Map displays with nearby people
- ✅ Location chat works
- ✅ Messages send and receive
- ✅ Photo upload works
- ✅ Offline mode works (enable Airplane mode)
- ✅ Safe area respected (no content behind notch)

---

## 🔄 Updating the App (For Future Releases)

When you make code changes:

1. **Update your Vercel deployment** (changes deploy automatically)
2. **Increment build number** in Xcode (e.g., `1` → `2`)
3. **Archive and upload** again (Steps 7-8)
4. **No re-review needed** for TestFlight updates (unless changing app behavior significantly)

**Important**: Since your app loads from Vercel, most updates don't require a new TestFlight build - just deploy to Vercel and testers will see changes instantly!

---

## 🐛 Troubleshooting

### "No valid signing certificate found"
→ Go to Xcode → Preferences → Accounts → Download Manual Profiles

### "Archive disabled"
→ Make sure you selected "Any iOS Device (arm64)", not a simulator

### "Build processing stuck"
→ Wait 15 minutes, then check App Store Connect

### "App crashes on launch"
→ Check Console logs in Xcode → Window → Devices and Simulators → View Device Logs

### "Location not working"
→ Make sure HTTPS is used (Vercel provides this automatically)

### "Offline mode not working"
→ Check browser console in Safari → Develop → [Your iPhone] → TapIn

---

## 📞 Support

- **Xcode Help**: [Apple Developer Forums](https://developer.apple.com/forums)
- **TestFlight Guide**: [Apple Documentation](https://developer.apple.com/testflight/)
- **Capacitor Docs**: [Capacitor iOS](https://capacitorjs.com/docs/ios)

---

## ✅ Ready to Deploy!

Your configuration is complete. Follow the steps above to get TapIn on TestFlight.

**Estimated time**: 30-45 minutes for first deployment
