/** @type {import('tailwindcss').Config} */
// Tokens from DESIGN.md §2–3. Contrast ratios are documented there.
// Each colour is a CSS variable (src/index.css) so light and dark themes share one set of class names.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: token('brand-primary'), // header, "+" button, focus rings
          accent: token('brand-accent'),   // hover states, links
        },
        surface: {
          page: token('surface-page'),
          card: token('surface-card'),
          border: token('surface-border'), // meets 3:1 non-text contrast in both themes
        },
        text: {
          primary: token('text-primary'),
          muted: token('text-muted'),
        },
        // Text/icons on a filled colour (buttons, badges): white in light, near-black in dark.
        'on-fill': token('on-fill'),
        // M6 tag-style — always paired with an icon + label
        type: {
          'safe-change': token('type-safe-change'), // teal
          bug: token('type-bug'),                   // magenta
        },
        // M8 due-tint — DEFAULT is the badge colour, tint is the card background
        due: {
          overdue: { DEFAULT: token('due-overdue'), tint: token('due-overdue-tint') },
          warning: { DEFAULT: token('due-warning'), tint: token('due-warning-tint') }, // < 24 hours
          soon:    { DEFAULT: token('due-soon'),    tint: token('due-soon-tint') },    // < 3 days
          safe:    { DEFAULT: token('due-safe'),    tint: token('due-safe-tint') },
          neutral: { DEFAULT: token('due-neutral'), tint: token('due-neutral-tint') }, // done
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
