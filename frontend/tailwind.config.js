/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        yeg: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          500: '#2F5496',
          600: '#1e3a6e',
          700: '#162c52',
          800: '#0f1f3a',
          900: '#091322',
        },
      },
    },
  },
  plugins: [],
}
