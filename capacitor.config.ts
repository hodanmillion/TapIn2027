import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL?.trim() || 'https://tap-in2026-jj45-git-main-hodans-projects-65e91166.vercel.app'
const useCleartext = serverUrl.startsWith('http://')

const config: CapacitorConfig = {
  appId: 'com.TapIn.myapp',
  appName: 'TapIn',
  webDir: '.next',
  server: {
    // Override with CAP_SERVER_URL for local simulator/device live-reload (e.g. http://192.168.1.50:3000)
    // Default stays on the deployed Vercel URL for TestFlight/production.
    url: serverUrl,
    cleartext: useCleartext,
  }
};

export default config;