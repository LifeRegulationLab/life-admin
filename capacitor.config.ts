import type { CapacitorConfig } from '@capacitor/cli';

// The phone shell: the same Vite build, copied into ios/ by `npm run build:shell`.
const config: CapacitorConfig = {
  appId: 'com.liferegulationlab.dealtwith',
  appName: 'Dealt With',
  webDir: 'dist',
  backgroundColor: '#f2f7f5',
  plugins: {
    LocalNotifications: { iconColor: '#2a8c82' },
  },
};

export default config;
