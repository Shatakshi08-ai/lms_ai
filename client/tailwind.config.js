/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wine: '#5A2829',
        rose: '#724542',
        terracotta: '#AE593A',
        peach: '#F8C695',
        tealdeep: '#297984',
        teal: '#4AA6A5',
        navy: '#5A2829',
        slateish: '#724542',
      },
    },
  },
  plugins: [],
};
