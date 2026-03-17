import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './stories/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Segoe UI',
          "'Segoe UI Web (West European)'",
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          "'Helvetica Neue'",
          'sans-serif',
        ],
      },
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: '#ffffff',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--foreground)',
        },
        subtle: {
          DEFAULT: 'var(--subtle)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        info: 'var(--info)',
        severe: 'var(--severe)',
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '6px',
        xl: '8px',
        '2xl': '12px',
        '3xl': '16px',
        full: '10000px',
      },
      boxShadow: {
        '2': '0 0 2px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.14)',
        '4': '0 0 2px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.14)',
        '8': '0 0 2px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.14)',
        '16': '0 0 2px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.14)',
        '28': '0 0 8px rgba(0,0,0,0.12), 0 14px 28px rgba(0,0,0,0.14)',
        '64': '0 0 8px rgba(0,0,0,0.12), 0 32px 64px rgba(0,0,0,0.14)',
      },
      fontSize: {
        'caption-2': ['10px', { lineHeight: '14px' }],
        'caption-1': ['12px', { lineHeight: '16px' }],
        'body-1': ['14px', { lineHeight: '20px' }],
        'body-2': ['16px', { lineHeight: '22px' }],
        'subtitle-2': ['16px', { lineHeight: '22px', fontWeight: '600' }],
        'subtitle-1': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'title-3': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'title-2': ['28px', { lineHeight: '36px', fontWeight: '600' }],
        'title-1': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'large-title': ['40px', { lineHeight: '52px', fontWeight: '600' }],
        display: ['68px', { lineHeight: '92px', fontWeight: '600' }],
      },
      animation: {
        'wave-spin': 'wave-spin 0.8s linear infinite',
        'wave-pulse': 'wave-pulse 1.5s ease-in-out infinite',
        'wave-indeterminate': 'wave-indeterminate 1.5s ease-in-out infinite',
      },
      keyframes: {
        'wave-spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'wave-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'wave-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(350%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
