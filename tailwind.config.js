/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Nunito Sans', 'system-ui', 'sans-serif'],
        hand: ['Caveat', 'Long Cang', 'cursive'],
        mono: ['DM Mono', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '18px', letterSpacing: '0.04em' }],
        sm: ['14px', { lineHeight: '22px', letterSpacing: '0.02em' }],
        base: ['16px', { lineHeight: '28px' }],
        lg: ['18px', { lineHeight: '26px' }],
        xl: ['22px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        '2xl': ['28px', { lineHeight: '38px', letterSpacing: '-0.02em' }],
        '3xl': ['36px', { lineHeight: '48px', letterSpacing: '-0.02em' }],
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '24px',
        6: '32px',
        7: '48px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '28px',
      },
      colors: {
        // Mood colors - Light mode
        mood: {
          happy: { main: '#FFB938', light: '#FFD66B', dark: '#FFA51F', soft: '#FFF7E0', glow: 'rgba(255,185,56,0.20)' },
          calm: { main: '#4DB8E5', light: '#6ECBF5', dark: '#38A5D8', soft: '#E5F4FC', glow: 'rgba(77,184,229,0.20)' },
          sad: { main: '#9B7AD9', light: '#B394E8', dark: '#8360CA', soft: '#F0E8FB', glow: 'rgba(155,122,217,0.20)' },
          inspired: { main: '#E876C4', light: '#F59AD4', dark: '#D458B0', soft: '#FBE5F5', glow: 'rgba(232,118,196,0.20)' },
          anxious: { main: '#FF7E5C', light: '#FF9C7E', dark: '#F56040', soft: '#FFE8E0', glow: 'rgba(255,126,92,0.20)' },
          tired: { main: '#B69A7E', light: '#C9B098', dark: '#A08263', soft: '#F2EBE0', glow: 'rgba(182,154,126,0.18)' },
        },
        // Neutral colors
        ink: {
          DEFAULT: '#3D352E',
          soft: '#8B8076',
          faint: '#BDB2A8',
        },
        paper: {
          DEFAULT: '#FDFBF7',
          warm: '#FFF5E8',
          cream: '#FDF0E3',
        },
        line: '#E8DFD3',
        brand: '#FFB938',
        card: 'rgba(255,253,249,0.72)',
        nav: 'rgba(245,242,235,0.68)',
      },
      boxShadow: {
        1: '0 1px 2px rgba(155,140,120,0.06), 0 1px 3px rgba(155,140,120,0.04)',
        2: '0 2px 8px rgba(155,140,120,0.08), 0 1px 3px rgba(155,140,120,0.05)',
        3: '0 8px 24px rgba(155,140,120,0.10), 0 2px 8px rgba(155,140,120,0.06)',
        4: '0 16px 48px rgba(155,140,120,0.14), 0 4px 16px rgba(155,140,120,0.08)',
        jelly: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.06)',
      },
      animation: {
        'jelly-bounce': 'jelly-bounce 220ms cubic-bezier(0.34,1.56,0.64,1)',
        'fade-up': 'fade-up 250ms ease-out',
        'fade-in': 'fade-in 200ms ease-out',
        'breath': 'breath 2s ease-in-out infinite',
        'today-glow': 'today-glow 3s ease-in-out infinite',
        'save-pulse': 'save-pulse 300ms ease-out',
        'slide-up': 'slide-up 300ms ease-out',
        'card-pop': 'card-pop 280ms cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        'jelly-bounce': {
          '0%': { transform: 'scale(0.85)' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1.0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'breath': {
          '0%, 100%': { opacity: '0.15' },
          '50%': { opacity: '0.30' },
        },
        'today-glow': {
          '0%, 100%': { boxShadow: '0 0 24px rgba(255,185,56,0.20)' },
          '50%': { boxShadow: '0 0 28px rgba(255,185,56,0.28)' },
        },
        'save-pulse': {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '60%': { transform: 'scale(1.2)', opacity: '1' },
          '100%': { transform: 'scale(1.0)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'card-pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.03)', opacity: '1' },
          '100%': { transform: 'scale(1.0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
