import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.TapIn.myapp',
  appName: 'TapIn',
  webDir: 'out',
  server: {
    url: 'https://tap-in2026-jj45.vercel.app/?v=20251215-1947',
    cleartext: true
  }
};

export default config;