import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.TapIn.myapp',
  appName: 'TapIn',
  webDir: 'out',
  server: {
    url: 'https://orchids-connect-ce8m4wqsj-hodans-projects-65e91166.vercel.app',
    cleartext: true
  }
};

export default config;