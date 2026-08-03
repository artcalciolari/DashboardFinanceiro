/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0D1B26',
        muted: '#54656F',
        faint: '#8695A0',
        forest: {
          DEFAULT: '#0B3A5C',
          hover: '#082E4A',
          deep: '#062540',
          soft: '#E8F0F6',
        },
        lime: {
          DEFAULT: '#7DE8FA',
          strong: '#5ADBF2',
        },
        paper: '#F5F7F8',
        card: '#FFFFFF',
        border: {
          DEFAULT: '#E1E6E9',
          faint: '#EBEEF1',
        },
        chip: '#EBEEF1',
        income: '#0E7A50',
        expense: '#BE4A33',
        amber: '#A8741A',
        category: {
          moradia: '#0B3A5C',
          alimentacao: '#0F5E8C',
          transporte: '#1480B4',
          lazer: '#3AA3CE',
          saude: '#7FC6E2',
          assinaturas: '#C08A45',
          outros: '#9AA6AD',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['40px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['28px', { lineHeight: '34px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'display-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '700' }],
        eyebrow: ['11px', { lineHeight: '14px', letterSpacing: '0.07em', fontWeight: '600' }],
      },
      borderRadius: {
        card: '16px',
        control: '10px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(13,27,38,0.05)',
        'card-hover': '0 10px 28px -10px rgba(13,27,38,0.14)',
        popover: '0 12px 32px -8px rgba(13,27,38,0.18)',
        modal: '0 24px 64px -12px rgba(6,37,64,0.35)',
        'focus-forest': '0 0 0 3px rgba(11,58,92,0.12)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      animation: {
        'sc-rise': 'sc-rise .35s cubic-bezier(0.22,1,0.36,1) both',
        'sc-fade': 'sc-fade .25s ease both',
        'sc-scale-in': 'sc-scale-in .22s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
