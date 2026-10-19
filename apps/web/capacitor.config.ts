import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.riverlight.poker',
  appName: 'Riverlight',
  webDir: 'dist',
  backgroundColor: '#171716',
  ios: {
    contentInset: 'never',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
