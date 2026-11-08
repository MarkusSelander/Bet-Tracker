/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        sunken: token('sunken'),
        surface: {
          DEFAULT: token('surface'),
          2: token('surface-2'),
        },
        elevated: token('elevated'),
        overlay: token('overlay'),
        border: token('border'),
        hairline: token('hairline'),
        input: token('input'),
        ring: token('ring'),
        foreground: token('foreground'),
        primary: {
          DEFAULT: token('primary'),
          strong: token('primary-strong'),
          foreground: token('primary-foreground'),
          glow: 'var(--primary-glow)',
        },
        destructive: {
          DEFAULT: token('destructive'),
          strong: token('destructive-strong'),
          foreground: token('text-primary'),
          glow: 'var(--destructive-glow)',
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('text-primary'),
        },
        warning: token('warning'),
        secondary: {
          DEFAULT: token('elevated'),
          foreground: token('text-primary'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground'),
        },
        text: {
          primary: token('text-primary'),
          secondary: token('text-secondary'),
          muted: token('text-muted'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Manrope', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        popover: '0 16px 40px -12px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(var(--border) / 0.9)',
        raised: '0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -16px rgb(0 0 0 / 0.8)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
