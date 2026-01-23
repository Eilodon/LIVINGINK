/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './constants.ts',
    './types.ts',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './tests/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;

