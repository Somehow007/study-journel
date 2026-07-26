/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['Noto Serif SC', 'Songti SC', 'STSong', 'serif'],
        sans: ['system-ui', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        displaylatin: ['Fraunces', 'serif'],
      },
      fontSize: {
        display: ['40px', { lineHeight: '48px', fontWeight: '600' }],
        h1: ['30px', { lineHeight: '38px', fontWeight: '600' }],
        h2: ['19px', { lineHeight: '28px', fontWeight: '600' }],
        title: ['16px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '26px', fontWeight: '400' }],
        diary: ['17px', { lineHeight: '32px', fontWeight: '400' }],
        small: ['13px', { lineHeight: '20px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.03em' }],
        num: ['13px', { lineHeight: '20px', fontWeight: '500' }],
        'num-sm': ['15px', { lineHeight: '24px', fontWeight: '500' }],
        'num-lg': ['28px', { lineHeight: '36px', fontWeight: '500' }],
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
        xl: '20px',
        '2xl': '28px',
        full: '999px',
      },
      colors: {
        // 中性色与品牌色唯一来源是 src/index.css 的 CSS 变量（晨园 / 夜色花房），
        // 此处仅 var() 引用，不留硬编码色值。
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
        accent: {
          DEFAULT: 'var(--accent)',
          ink: 'var(--accent-ink)',
        },
        // 心情六色唯一来源是 src/lib/constants.ts 的 MOOD_CONFIGS（含深色档），
        // 不在此处重复定义，避免 token 漂移。
      },
      boxShadow: {
        1: '0 1px 2px rgba(44,50,42,0.04), 0 8px 24px rgba(44,50,42,0.05)',
        2: '0 2px 6px rgba(44,50,42,0.06), 0 12px 32px rgba(44,50,42,0.08)',
        3: '0 2px 8px rgba(44,50,42,0.08), 0 16px 40px rgba(44,50,42,0.10)',
        4: '0 4px 12px rgba(44,50,42,0.08), 0 24px 56px rgba(44,50,42,0.14)',
        'dark-1': '0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.28)',
        'dark-2': '0 2px 6px rgba(0,0,0,0.35), 0 12px 32px rgba(0,0,0,0.28)',
        'dark-3': '0 2px 8px rgba(0,0,0,0.35), 0 16px 40px rgba(0,0,0,0.28)',
        'dark-4': '0 4px 12px rgba(0,0,0,0.35), 0 24px 56px rgba(0,0,0,0.28)',
      },
      animation: {
        'bloom-in': 'bloom-in 240ms cubic-bezier(0.34,1.4,0.64,1)',
        'fade-up': 'fade-up 250ms ease-out',
        'fade-in': 'fade-in 200ms ease-out',
        'save-pulse': 'save-pulse 200ms ease-out',
        'slide-up': 'slide-up 220ms ease-out',
      },
      keyframes: {
        'bloom-in': {
          '0%': { transform: 'scale(0.6) rotate(-8deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
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
