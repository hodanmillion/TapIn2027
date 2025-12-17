import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.TapIn.myapp',
  appName: 'TapIn',
  webDir: '.next',
  server: {
    // For TestFlight/production builds, use your Vercel URL
    // For local development in Simulator, comment out this server block
    url: 'https://tap-in2026-jj45-git-main-hodans-projects-65e91166.vercel.app',
    cleartext: false
  }
};

export default config;