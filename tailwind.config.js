/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './*.js',
    './personality/*.html',
  ],
  theme: {
    extend: {
      colors: {
        purple: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
          400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
          800: '#5b21b6', 900: '#4c1d95'
        },
        cream: '#FFF8F0',
        mint: '#99F6E4',
        coral: '#FDA4AF',
        sky: '#7DD3FC'
      },
      fontFamily: { sans: ['Inter', 'Noto Sans SC', 'sans-serif'] }
    }
  },
  plugins: [],
}
