import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        physics: 'hsl(var(--physics))',
        success: 'hsl(var(--success))',
      },
      borderRadius: {
        xl: 'var(--radius)',
        lg: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 7px)',
      },
      fontFamily: {
        sans: ['Manrope Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Manrope Variable', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 14px 45px rgba(15, 23, 42, 0.06)',
        float: '0 20px 60px rgba(16, 24, 48, 0.14)',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '0.58' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
