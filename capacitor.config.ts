import type { CapacitorConfig } from '@capacitor/cli';

// The phone shell: the same Vite build, copied into ios/ by `npm run build:shell`.
const config: CapacitorConfig = {
  appId: 'com.liferegulationlab.dealtwith',
  appName: 'Dealt With',
  webDir: 'dist',
  backgroundColor: '#f4f1ea',
  plugins: {
    LocalNotifications: { iconColor: '#f2b544' },
  },
};

export default config;
