import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.TapIn.myapp',
  appName: 'TapIn',
  webDir: 'out',
  server: {
    url: 'https://orchids-connect-app.vercel.app/app',
    cleartext: true
  }
};

export default config;