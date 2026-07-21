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
        /^(bg|text|border)-(gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|sage|ocean|clay|ochre|terracotta|heather|plum|jade|blush|moss)-(50|100|200|300|400|500|800|900)$/,
      variants: ['dark'],
    },
    {
      pattern:
        /^bg-(gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|sage|ocean|clay|ochre|terracotta|heather|plum|jade|blush|moss)-(800|900)\/(20|30|50)$/,
      variants: ['dark'],
    },
    {
      pattern:
        /^border-(gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|sage|ocean|clay|ochre|terracotta|heather|plum|jade|blush|moss)-(600|700|800)$/,
      variants: ['dark'],
    },
  ],
  theme: {
    extend: {
      fontFamily: {
        // Merriweather is the single universal typeface — both the default (sans)
        // and the explicit `font-serif` headings resolve to it, so the whole app
        // renders in one face. Only `font-mono` (code blocks) differs, by design.
        sans: ['Merriweather', 'Georgia', 'serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
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
        // Timetable palette families (muted earth tones; see utils/timetablePalette.ts).
        // ocean/clay copied from Smart-Budget; the rest derived from the accent hexes.
        ocean: {
          50: '#f1f5f8', 100: '#dde8ee', 200: '#b9cedb', 300: '#8fb0c4', 400: '#6690ab',
          500: '#436d88', 600: '#385c73', 700: '#2f4c5f', 800: '#283e4d', 900: '#22343f',
        },
        clay: {
          50: '#f9f5f0', 100: '#f1e7db', 200: '#e2cdb5', 300: '#d0af8e', 400: '#c09c76',
          500: '#b08968', 600: '#997254', 700: '#7d5c44', 800: '#654b39', 900: '#533e30',
        },
        ochre: {
          50: '#faf6ea', 100: '#f3ead0', 200: '#e7d5a3', 300: '#d9bc70', 400: '#cda84b',
          500: '#c1972f', 600: '#a37e27', 700: '#836521', 800: '#6b521e', 900: '#59451c',
        },
        terracotta: {
          50: '#f9f1ee', 100: '#f2e1da', 200: '#e4c3b6', 300: '#d3a08c', 400: '#c38369',
          500: '#b3684e', 600: '#9a5741', 700: '#7e4736', 800: '#683b2e', 900: '#563228',
        },
        heather: {
          50: '#f5f3f8', 100: '#eae6f1', 200: '#d5cde3', 300: '#b9adcf', 400: '#9c8db6',
          500: '#7f6d9e', 600: '#6c5c88', 700: '#594c70', 800: '#4a405c', 900: '#3e364c',
        },
        plum: {
          50: '#f7f2f4', 100: '#efe3e8', 200: '#dfc6d1', 300: '#c9a2b2', 400: '#a97d90',
          500: '#8a5a6e', 600: '#764c5e', 700: '#613e4d', 800: '#503440', 900: '#422b35',
        },
        jade: {
          50: '#f1f6f5', 100: '#e0ebea', 200: '#c2d8d6', 300: '#9bbebb', 400: '#7aa6a2',
          500: '#5f8f8b', 600: '#4f7975', 700: '#426360', 800: '#385250', 900: '#304544',
        },
        blush: {
          50: '#f9f2f2', 100: '#f1e2e2', 200: '#e2c6c6', 300: '#cda1a1', 400: '#b98383',
          500: '#a56a6a', 600: '#8e5757', 700: '#754848', 800: '#613d3d', 900: '#513434',
        },
        moss: {
          50: '#f5f6f0', 100: '#e9ebdd', 200: '#d1d6b6', 300: '#b3bb8b', 400: '#98a36c',
          500: '#7c8b5a', 600: '#68764a', 700: '#55603d', 800: '#464f33', 900: '#3b422c',
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
