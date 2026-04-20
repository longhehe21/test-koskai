import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        kiosk: {
          bg: '#f5f5f7',
          surface: '#ffffff',
          border: '#e5e7eb',
          text: '#1a1a2e',
          'text-secondary': '#1e293b',
          'text-muted': '#64748b',
          primary: '#2563eb',
          'primary-dark': '#1e3a8a',
          success: '#22c55e',
          error: '#ef4444',
          warning: '#d97706',
        },
        ai: {
          bg: '#08080c',
          surface: '#101018',
          'surface-elev': '#191924',
          border: '#2a2a38',
          text: '#e8e8ef',
          'text-dim': '#9095a3',
          accent: '#7c5cff',
          'accent-dim': '#4a3ca8',
          ok: '#3ddc84',
          warn: '#ffb648',
          err: '#ff5566',
        },
      },
      fontFamily: {
        sans: ['Public Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        kiosk: '14px',
      },
    },
  },
  plugins: [],
};

export default config;
