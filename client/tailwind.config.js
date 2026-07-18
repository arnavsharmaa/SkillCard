/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palette matched to heymaw.com — light "blueprint paper" + blue accent.
        ink: '#fbfef9', // paper: page background AND text-on-accent
        panel: '#ffffff', // cards
        panel2: '#f1f4ec', // subtle nested fills / inputs / chips
        edge: '#e5e7eb', // hairline borders
        muted: '#727a80', // secondary text
        accent: '#0c6291', // heymaw blue (single accent)
        accentDim: '#0a4d72',
        danger: '#a63446', // heymaw rose
        warn: '#b45309', // amber that sits in the palette
        // Override `white` so the many `text-white` usages become charcoal body
        // text on the light theme (bg-white / border-white are unused).
        white: '#2b3036',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
