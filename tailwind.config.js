/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'Sarabun', 'Tahoma', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
