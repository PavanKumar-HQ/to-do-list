import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saral.lifeos',
  appName: 'Saral',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
