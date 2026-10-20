/** @type {import('tailwindcss').Config} */
// Tokens from DESIGN.md §2–3. Contrast ratios are documented there.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3730A3', // indigo — header, "+" button, focus rings
          accent: '#4F46E5',  // hover states, links
        },
        surface: {
          page: '#F8FAFC',
          card: '#FFFFFF',
          border: '#64748B',  // 4.8:1 on card, meets 3:1 non-text contrast
        },
        text: {
          primary: '#0F172A',
          muted: '#475569',
        },
        // M6 tag-style — always paired with an icon + label
        type: {
          'safe-change': '#0F766E', // teal
          bug: '#9D174D',           // magenta
        },
        // M8 due-tint — DEFAULT is the badge colour, tint is the card background
        due: {
          overdue: { DEFAULT: '#B91C1C', tint: '#FEF2F2' },
          warning: { DEFAULT: '#B45309', tint: '#FFF7ED' }, // < 24 hours
          soon:    { DEFAULT: '#854D0E', tint: '#FEFCE8' }, // < 3 days
          safe:    { DEFAULT: '#15803D', tint: '#FFFFFF' },
          neutral: { DEFAULT: '#475569', tint: '#F1F5F9' }, // done
        },
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      minHeight: { target: '44px' },
      minWidth: { target: '44px' },
    },
  },
  plugins: [],
};
