/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0b0e',
        panel: '#121419',
        panel2: '#1a1d24',
        edge: '#262a33',
        muted: '#8b93a1',
        accent: '#37e6a4', // single restrained accent
        accentDim: '#1f9c72',
        danger: '#ff5c6c',
        warn: '#ffb547',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
