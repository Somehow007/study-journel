/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['Noto Serif SC', 'Songti SC', 'STSong', 'serif'],
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'DM Mono', 'monospace'],
        hand: ['Caveat', 'cursive'],
      },
      fontSize: {
        display: ['40px', { lineHeight: '48px', letterSpacing: '-0.01em', fontWeight: '600' }],
        h1: ['28px', { lineHeight: '36px', fontWeight: '600' }],
        h2: ['19px', { lineHeight: '28px', fontWeight: '600' }],
        title: ['17px', { lineHeight: '26px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '28px', fontWeight: '400' }],
        diary: ['17px', { lineHeight: '32px', fontWeight: '400' }],
        small: ['13px', { lineHeight: '20px', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.04em' }],
        num: ['13px', { lineHeight: '20px', fontWeight: '500' }],
        'num-sm': ['15px', { lineHeight: '24px', fontWeight: '400' }],
        'num-lg': ['24px', { lineHeight: '32px', fontWeight: '500' }],
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '24px',
        6: '32px',
        7: '48px',
        8: '64px',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        full: '999px',
      },
      colors: {
        // 中性色与品牌色全部指向 CSS 变量（index.css），
        // 由 data-palette（配色主题）与 .dark（深浅模式）驱动，此处不留硬编码色值。
        paper: 'var(--paper)',
        card: 'var(--card)',
        overlay: 'var(--overlay)',
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
          faint: 'var(--ink-faint)',
        },
        hairline: 'var(--hairline)',
        keyline: 'var(--keyline)',
        brand: {
          DEFAULT: 'var(--brand)',
          ink: 'var(--brand-ink)',
        },
        pine: 'var(--pine)',
        // 心情六色唯一来源是 src/lib/constants.ts 的 MOOD_CONFIGS（含深色档），
        // 不在此处重复定义，避免 token 漂移。
      },
      boxShadow: {
        1: '0 1px 2px rgba(28,32,36,0.05), 0 2px 6px rgba(28,32,36,0.04)',
        2: '0 1px 3px rgba(28,32,36,0.07), 0 6px 16px rgba(28,32,36,0.07)',
        3: '0 2px 6px rgba(28,32,36,0.08), 0 12px 32px rgba(28,32,36,0.10)',
        4: '0 4px 12px rgba(28,32,36,0.08), 0 24px 56px rgba(28,32,36,0.14)',
        'dark-1': '0 1px 2px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.25)',
        'dark-2': '0 1px 3px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.25)',
        'dark-3': '0 2px 6px rgba(0,0,0,0.35), 0 12px 32px rgba(0,0,0,0.25)',
        'dark-4': '0 4px 12px rgba(0,0,0,0.35), 0 24px 56px rgba(0,0,0,0.25)',
      },
      animation: {
        'stamp-in': 'stamp-in 140ms cubic-bezier(0.2,0.9,0.3,1)',
        'fade-up': 'fade-up 250ms ease-out',
        'fade-in': 'fade-in 200ms ease-out',
        'save-pulse': 'save-pulse 200ms ease-out',
        'slide-up': 'slide-up 220ms ease-out',
      },
      keyframes: {
        'stamp-in': {
          '0%': { transform: 'scale(1.18)', opacity: '0.6' },
          '100%': { transform: 'scale(1.0)', opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'save-pulse': {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '60%': { transform: 'scale(1.2)', opacity: '1' },
          '100%': { transform: 'scale(1.0)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
