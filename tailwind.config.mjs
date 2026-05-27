/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,tsx,ts,jsx,js}'],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f6f6f7',
          100: '#e2e3e5',
          200: '#c4c5ca',
          300: '#9fa1a9',
          400: '#7b7d87',
          500: '#61636e',
          600: '#4d4e58',
          700: '#3f4048',
          800: '#35363c',
          900: '#2e2f34',
          950: '#1a1b1f',
        },
        accent: {
          DEFAULT: '#71C8F4',
          hover: '#5ABFF1',
          dark: '#39B2EF',
        },
      },
    },
  },
  plugins: [],
};
