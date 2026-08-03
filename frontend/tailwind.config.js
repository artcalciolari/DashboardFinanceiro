/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1F19',
        muted: '#5A6861',
        faint: '#8B968F',
        forest: {
          DEFAULT: '#0B3529',
          hover: '#082A20',
          deep: '#06231B',
          soft: '#EAF1ED',
        },
        lime: {
          DEFAULT: '#C8F169',
          strong: '#B5E04C',
          soft: '#F2FAD9',
        },
        paper: '#F5F4EF',
        card: '#FFFFFF',
        border: {
          DEFAULT: '#E6E4DB',
          faint: '#EFEDE4',
        },
        chip: '#EFEDE4',
        income: '#0E7A50',
        expense: '#BE4A33',
        amber: '#A8741A',
        category: {
          moradia: '#0C3B2E',
          alimentacao: '#12664A',
          transporte: '#2E8B63',
          lazer: '#57A97F',
          saude: '#86C6A0',
          assinaturas: '#B7844A',
          outros: '#9AA39B',
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
        card: '0 1px 2px rgba(15,31,25,0.05)',
        'card-hover': '0 10px 28px -10px rgba(15,31,25,0.14)',
        popover: '0 12px 32px -8px rgba(15,31,25,0.18)',
        modal: '0 24px 64px -12px rgba(6,35,27,0.35)',
        'focus-forest': '0 0 0 3px rgba(11,53,41,0.12)',
        'focus-lime': '0 0 0 3px rgba(200,241,105,0.35)',
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
