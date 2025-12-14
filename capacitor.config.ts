import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.TapIn.myapp',
  appName: 'TapIn',
  webDir: '.next',
  server: {
    url: 'https://tapin-connect.vercel.app',
    cleartext: true
  }
};

export default config;