/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'donezo-dark': '#1e5138', // Deep forest/emerald green
        'donezo-primary': '#2c7a51', // Bright actionable green
        'donezo-light': '#e6f0eb', // Subtle green bg
        'donezo-bg': '#f3f4f6', // Light gray background
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'donezo': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 0 3px rgba(0,0,0,0.02)',
      }
    },
  },
  plugins: [],
}
