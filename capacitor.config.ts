import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.TapIn.myapp',
  appName: 'TapIn',
  webDir: '.next',
  server: {
    url: process.env.NODE_ENV === 'production' 
      ? 'https://tap-in2026-jj45-git-main-hodans-projects-65e91166.vercel.app'
      : 'http://localhost:3000',
    cleartext: true
  }
};

export default config;