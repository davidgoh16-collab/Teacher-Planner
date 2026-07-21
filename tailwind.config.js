/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './constants.ts',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  // User data (timetable cells, project/app/category colours) stores full Tailwind class
  // strings in Firestore. The content globs above cover every string the current palettes
  // can write, but historical documents may hold classes no longer present in source —
  // this safelist keeps those rendering after the CDN -> build-time migration.
  safelist: [
    {
      pattern:
        /^(bg|text|border)-(gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate)-(50|100|200|300|400|500|800|900)$/,
      variants: ['dark'],
    },
    {
      pattern:
        /^bg-(gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate)-(800|900)\/(20|30|50)$/,
      variants: ['dark'],
    },
    {
      pattern:
        /^border-(gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate)-(600|700|800)$/,
      variants: ['dark'],
    },
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
      colors: {
        // Runtime-themeable accent scale driven by --primary-* CSS variables
        // (see utils/themeColor.ts and the pre-paint script in index.html).
        primary: {
          50: 'rgb(var(--primary-50) / <alpha-value>)',
          100: 'rgb(var(--primary-100) / <alpha-value>)',
          200: 'rgb(var(--primary-200) / <alpha-value>)',
          300: 'rgb(var(--primary-300) / <alpha-value>)',
          400: 'rgb(var(--primary-400) / <alpha-value>)',
          500: 'rgb(var(--primary-500) / <alpha-value>)',
          600: 'rgb(var(--primary-600) / <alpha-value>)',
          700: 'rgb(var(--primary-700) / <alpha-value>)',
          800: 'rgb(var(--primary-800) / <alpha-value>)',
          900: 'rgb(var(--primary-900) / <alpha-value>)',
          950: 'rgb(var(--primary-950) / <alpha-value>)',
        },
        // Static brand scale shared across David's apps (logged-out chrome, owner swatch).
        sage: {
          50: '#f4f7f2',
          100: '#e6ede2',
          200: '#cedcc6',
          300: '#adc2a2',
          400: '#8ba57d',
          500: '#79946e',
          600: '#5d7752',
          700: '#4a5f42',
          800: '#3d4e37',
          900: '#33402e',
          950: '#1a2217',
        },
      },
      keyframes: {
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up 200ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [],
};
