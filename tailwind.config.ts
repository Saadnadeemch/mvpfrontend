// tailwind.config.js  (only needed if using Tailwind v3)
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

// If using Tailwind v4 with @import "tailwindcss" in your CSS,
// add this line inside your styles.css after the @import:
//
// @variant dark (&:where(.dark, .dark *));