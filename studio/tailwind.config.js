/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'bg-gray-400', 'bg-blue-400', 'bg-orange-400', 'bg-purple-400',
    'bg-teal-400', 'bg-pink-400', 'bg-yellow-400', 'bg-green-400',
    'border-blue-500', 'border-purple-500', 'border-orange-500',
    'border-yellow-500', 'border-green-500', 'border-teal-500',
    'border-pink-500', 'border-red-500', 'border-amber-500',
  ],
};
