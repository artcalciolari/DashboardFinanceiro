/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12241D',
        muted: '#5B6B63',
        faint: '#8A978F',
        forest: {
          DEFAULT: '#0C3B2E',
          hover: '#0A3227',
        },
        lime: '#C8F169',
        paper: '#F4F2EC',
        card: '#FFFFFF',
        border: {
          DEFAULT: '#E6E3DA',
          faint: '#F2F0E8',
        },
        chip: '#F0EEE6',
        income: '#0F7A52',
        expense: '#C0523B',
        amber: '#B07A1E',
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
      borderRadius: {
        card: '20px',
        control: '12px',
        pill: '20px',
      },
      boxShadow: {
        modal: '0 24px 60px rgba(12,36,29,0.25)',
        'focus-forest': '0 0 0 3px rgba(12,59,46,0.1)',
      },
    },
  },
  plugins: [],
};
