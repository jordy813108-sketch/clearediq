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
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
        // cleaREDiq brand identity — red is a sharp ACCENT, navy is structure.
        red: {
          50: '#fff0f0',
          100: '#ffdcdc',
          200: '#ffbcbc',
          500: '#E02020',
          600: '#c81a1a',
          700: '#a81515',
        },
        navy: {
          50: '#f3f4f8',
          100: '#e2e4ee',
          500: '#3a4170',
          700: '#252b52',
          900: '#1a1f3a',
        },
        // Neutral foundation
        canvas: '#f8f9fc',
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
