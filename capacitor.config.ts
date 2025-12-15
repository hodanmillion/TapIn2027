import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.TapIn.myapp',
  appName: 'TapIn',
  webDir: 'public',
  server: {
    url: 'https://tap-in2026-jj45.vercel.app',
    cleartext: true
  }
};

export default config;