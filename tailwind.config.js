/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF4FF',
          100: '#D9E5FF',
          200: '#BCD0FF',
          300: '#8EB0FF',
          400: '#5985FF',
          500: '#3361FF',
          600: '#1B3FF5',
          700: '#142CE1',
          800: '#1725B6',
          900: '#19258F',
          950: '#141857',
        },
      },
    },
  },
  plugins: [],
};
