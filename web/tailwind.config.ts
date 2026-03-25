import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#102033',
        sand: '#f7f4ee',
        ember: '#ff7a59',
        moss: '#2f8f83',
        mist: '#dce8f7',
        sky: '#78a6ff',
        night: '#0d1726',
        aurora: '#6ee7c8',
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 24px 80px rgba(16, 32, 51, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
