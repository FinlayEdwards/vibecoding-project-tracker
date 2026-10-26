/** @type {import('tailwindcss').Config} */
// Lineage tokens. Each decision and its contrast ratio is justified in docs/design-rationale.html.
// Each colour is a CSS variable (src/index.css) so light and dark themes share one set of class names.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: token('brand-primary'), // ink: primary buttons, selected tab
          accent: token('brand-accent'),   // indigo: focus rings, links, drop targets
        },
        surface: {
          page: token('surface-page'),
          card: token('surface-card'),
          subtle: token('surface-subtle'),     // column wells, hover fills
          hairline: token('surface-hairline'), // decorative dividers only
          border: token('surface-border'),     // control borders: meets 3:1 non-text contrast in both themes
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
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // 36px controls, 32px icon buttons: compact, still above WCAG 2.5.8's 24px minimum.
      minHeight: { target: '2.25rem', 'target-sm': '2rem' },
      minWidth: { target: '2.25rem', 'target-sm': '2rem' },
    },
  },
  plugins: [],
};
