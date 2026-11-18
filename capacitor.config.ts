import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.Azi.backgroundremover',
  appName: 'Background Remover by AZI CREATION',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false, // the app hides it once the UI is ready
      backgroundColor: '#0a0e1f',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0e1f',
    },
  },
};

export default config;
