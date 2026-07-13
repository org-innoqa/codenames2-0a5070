/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spyred: {
          light: '#ef4444',
          DEFAULT: '#dc2626',
          dark: '#991b1b',
        },
        spyblue: {
          light: '#3b82f6',
          DEFAULT: '#2563eb',
          dark: '#1e3a8a',
        },
        spyneutral: {
          light: '#f5f5f4',
          DEFAULT: '#e7e5e4',
          dark: '#78716c',
        },
        spyassassin: {
          DEFAULT: '#1c1917',
          dark: '#0c0a09',
        }
      }
    },
  },
  plugins: [],
}