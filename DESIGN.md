# Vibecoding Project Tracker — Design

**Status:** Filled in for `design-done` (M3). Accessibility is the main constraint behind every decision: the tracker should work for people with low vision, colour-vision deficiency, motor impairments, and people using screen readers or only a keyboard. The tokens below are in `tailwind.config.js`.

**Target:** WCAG 2.2 Level AA as the floor (PRD §10), with AAA contrast for body text wherever possible. Every contrast ratio below was calculated with the WCAG relative-luminance formula.

---

## 1. Mood / vibe

**Calm, legible and unambiguous: a tool you can read at 11pm under stress, with tired eyes, and still know exactly what is late and what to do next.**

References:

- [GOV.UK Design System](https://design-system.service.gov.uk/) — plain, high-contrast, accessibility-tested patterns; thick visible focus states.
- [Linear](https://linear.app/) — quiet surfaces where only status and priority carry colour.
- [Braille Institute — Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) — typography designed for low-vision readers.

Anti-references, explicitly **not**:

- Neon/gradient "AI product" aesthetics, glassmorphism, and low-contrast grey-on-grey text.
- Dashboards that communicate status with a red/green dot and nothing else.
- Dense Jira-style cards where everything competes for attention.

## 2. Color palette

Light and dark themes share the same tokens (see "Dark theme" below). One rule throughout: **colour reinforces meaning, it never carries it alone** (WCAG 1.4.1 Use of Color). Every coloured state also has an icon and a text label.

### Brand

| Token | Hex | Where it shows up | Contrast |
|---|---|---|---|
| `brand-primary` | `#3730A3` | Header, "+" button, focus rings | 9.9:1 white on it; 9.5:1 against page |
| `brand-accent` | `#4F46E5` | Hover states, links (always underlined) | 6.3:1 on card |
| `surface-page` | `#F8FAFC` | Page background | — |
| `surface-card` | `#FFFFFF` | Card background | — |
| `surface-border` | `#64748B` | Card, input and column borders | 4.8:1 on card (needs 3:1, WCAG 1.4.11) |
| `text-primary` | `#0F172A` | Body text | 17.9:1 on card (AAA) |
| `text-muted` | `#475569` | Captions, dates, counts | 7.6:1 on card (AAA) |

Why this palette:

- **Off-white page with a near-black (not pure black) text colour.** Very high contrast without the glare/halation that pure `#000` on `#FFF` causes for some readers with astigmatism or dyslexia.
- **Muted text still passes AAA.** "Muted" is usually where accessibility breaks; here captions are 7.6:1, so secondary info (due dates!) stays readable.
- **Indigo brand.** Its hue sits outside both the task-type pair and the urgency ramp, so a brand-coloured button is never mistaken for a status.
- **Borders at 3:1+.** Card and input edges must be visible to low-vision users (WCAG 1.4.11 Non-text Contrast); the common light-grey `#CBD5E1`-style border fails this.

### Task type (M6 `tag-style`)

The PRD (§5–6) defines types as `bug` and `safe_change`, so those are the token names.

| Token | Hex | When used | Icon (Lucide) | Contrast |
|---|---|---|---|---|
| `type-safe-change` | `#0F766E` (teal) | Cards with type `safe_change`: 4px left stripe + badge | `shield-check` + "Safe change" | 5.5:1 on card |
| `type-bug` | `#9D174D` (magenta) | Cards with type `bug`: 4px left stripe + badge | `bug` + "Bug" | 7.9:1 on card |

Why teal vs. magenta instead of the usual green vs. red: red/green is the pair most often confused by people with deuteranopia/protanopia (about 1 in 12 men). Teal and magenta stay distinct under all three common colour-vision deficiencies, and they also differ in lightness. The icon and the text label mean the type is still identifiable in greyscale or on a monochrome screen.

### Due-date states (M8 `due-tint`)

PRD §10 requires four urgency states plus a distinct done state. Thresholds live as constants in code (`DUE_SOON_DAYS = 3`, `DUE_WARNING_HOURS = 24`). Each state = card tint + badge (strong colour as background, white text) + icon + text label.

| Token | Hex (badge) | Tint (card bg) | When used | Icon | Label | Contrast |
|---|---|---|---|---|---|---|
| `due-overdue` | `#B91C1C` | `#FEF2F2` | Past due | `alert-octagon` | "Overdue" | 6.5:1 white on badge |
| `due-warning` | `#B45309` | `#FFF7ED` | Due within 24 hours | `alarm-clock` | "Due today" / "Due in 5h" | 5.0:1 |
| `due-soon` | `#854D0E` | `#FEFCE8` | Due within 3 days | `clock` | "Due in 2 days" | 6.9:1 |
| `due-safe` | `#15803D` | none (white card) | More than 3 days out | `calendar-check` | "On track" | 5.0:1 |
| `due-neutral` | `#475569` | `#F1F5F9` | Done (overrides date) | `check-circle-2` | "Done" | 6.9:1 |

Why it is built this way:

- **Urgency increases with visual weight, not just hue.** On-track cards have no tint at all; tints only appear as things get urgent, so a scan of the board shows the problem cards first (visual hierarchy / pre-attentive processing).
- **Different icon shapes for every state.** Octagon (stop sign) for overdue, alarm for <24h, clock for soon. Shape is the redundant cue for anyone who can't tell amber from yellow.
- **Labels say the actual time**, e.g. "Due in 5h", not just "Warning". It's more useful and it is what a screen reader will announce.
- **Tints are pale (≈97% lightness)** so body text on tinted cards still exceeds 15:1.
- **Done overrides everything** with a neutral grey, so finished work stops shouting.

### Dark theme

Added after M12. Some low-vision users (photophobia, glare sensitivity, some cataract and migraine conditions) find a dark interface much easier to use; others find light-on-dark harder to read (astigmatism halation). So the theme is a **user choice, defaulting to the OS setting**: System / Light / Dark toggle in the header, saved per browser, applied before first paint so there is no flash.

Every token is a CSS variable (`src/index.css`), so components use the same class names in both themes. Dark values are lighter, desaturated tones on slate — never pure black, and never the light-mode hues on a dark background, which would fail contrast.

| Token | Dark hex | Contrast (dark) |
|---|---|---|
| `surface-page` / `surface-card` | `#0F172A` / `#1E293B` | — |
| `surface-border` | `#94A3B8` | 5.7:1 on card |
| `text-primary` / `text-muted` | `#F1F5F9` / `#CBD5E1` | 13.4:1 / 9.9:1 on card |
| `brand-primary` / `brand-accent` | `#A5B4FC` / `#C7D2FE` | 7.3:1 / 9.8:1 on card |
| `on-fill` (text on filled colours) | `#0F172A` | ≥ 9:1 on every badge/button |
| `type-safe-change` / `type-bug` | `#5EEAD4` / `#F9A8D4` | 9.9:1 / 8.1:1 on card |
| `due-overdue` / `-warning` / `-soon` / `-safe` / `-neutral` | `#FCA5A5` / `#FDBA74` / `#FDE047` / `#86EFAC` / `#CBD5E1` | ≥ 9.4:1 with `on-fill` text |
| Tints: overdue / warning / soon / done | `#3B1A22` / `#3A2416` / `#33300F` / `#162032` | text ≥ 12:1, muted ≥ 9:1 |

Every dark pairing meets **AAA** (7:1). The `on-fill` token is the one structural change: filled badges and buttons use white text in light mode and near-black text in dark mode, because the dark-mode fills are light.

## 3. Typography

| Role | Font | Why |
|---|---|---|
| Heading | Atkinson Hyperlegible Next (700) | Designed by the Braille Institute specifically for low-vision readers; one family for headings and body keeps the page calm. |
| Body | Atkinson Hyperlegible Next (400) | Exaggerated letterforms make easily confused characters distinct (`I l 1`, `O 0`, `b d p q`), which matters for people with low vision and dyslexia. |
| Monospace (tags, badges, code) | Atkinson Hyperlegible Mono | Same hyperlegible design principles for `TASK-001` IDs and AI-context code blocks, where `0/O` and `1/l` confusion would otherwise be a real bug risk. |

All three load from Google Fonts with a system-font fallback (`font-display: swap`), so text is never invisible while fonts load.

Sizes — **deliberately larger than the starter defaults** for low-vision users:

- Page title: 28 px / bold
- Section / column header: 18 px / bold (sentence case, not uppercase: all-caps text is harder to read because word shapes disappear)
- Card title: 16 px / semibold
- Body: 16 px / regular, line-height 1.5 (WCAG 1.4.12 Text Spacing)
- Caption: 14 px / regular, `text-muted` (never smaller than 14 px)

All sizes are in `rem`, so the layout respects the user's browser font-size setting and survives 200% zoom (WCAG 1.4.4 Resize Text) and 400% reflow at 320px width (WCAG 1.4.10 Reflow).

## 4. Component principles

- **Cards:** White with a 1px `surface-border` edge and a 4px type-coloured left stripe; the whole card is a single `<button>`-like focus target whose accessible name is "TASK-001, title, type, status, due state".
- **Buttons:** Solid `brand-primary` fill with white text, at least 44×44px hit area (WCAG 2.5.8 sets 24px; 44px is the comfortable size for motor impairments), always a visible text label; icon-only buttons get an `aria-label`.
- **Focus:** Every interactive element shows a 3px `brand-primary` outline with a 2px offset, applied via `:focus-visible` and never removed (WCAG 2.4.7 / 2.4.11); focus is never hidden behind sticky headers.
- **Modal:** Centered, max-width 640px, `slate-900` backdrop at 60%; uses `role="dialog"` + `aria-modal`, traps focus, closes on Esc, and returns focus to the card that opened it.
- **Forms:** Every input has a visible `<label>` (no placeholder-only labels); errors appear as text next to the field with an icon and are linked via `aria-describedby`.
- **Empty states:** Dashed `surface-border` outline, muted text, encouraging tone, plus the "+" action so the next step is obvious.
- **Drag affordance:** Drag-and-drop is the unique interaction (PRD §9), shown by a `grip-vertical` handle. Dragging is **never the only way**: every card also has a joined ← ↑ ↓ → button group (previous column, up, down, next column), so it works with a keyboard, a switch device or a single pointer (WCAG 2.5.7 Dragging Movements). Focus follows the card when it changes column, and moves are announced via an `aria-live` region.
- **Motion:** Only a 200ms fade on toasts and drag lift; all motion is disabled under `prefers-reduced-motion` (WCAG 2.3.3).
- **Toasts:** Rendered in an `aria-live="polite"` region so screen readers announce them (WCAG 4.1.3 Status Messages); they stay at least 5 seconds and pause on hover/focus. Each has a 44px "Dismiss" button.
- **Cards stay calm:** "Hand off" is a disclosure button (`aria-expanded`) that reveals the person picker, rather than a form on every card; focus moves into it on open and back to the button after the hand-off.
- **Collapsible cards:** a chevron (`aria-expanded`, "Show/Hide details for TASK-001") shrinks a card to its title; "Collapse all / Expand all" sits above the board and as an icon button in each column header. The tint and type stripe stay on collapsed cards, and the choice is saved per browser.
- **Skip link:** "Skip to main content" is the first Tab stop, hidden until focused (WCAG 2.4.1 Bypass Blocks).
- **Forced colours:** filled badges and the toast carry a transparent border so Windows High Contrast still draws their edges; the decorative foil outline is turned off there.

## 5. Voice / microcopy

Plain, specific and calm. Say what happened and what to do next; no jokes that a screen reader turns into noise.

| Where | Text |
|---|---|
| "+" button label | "+ New ticket" (`aria-label="Create new ticket"`) |
| Empty column placeholder | "No tickets in {column} yet." |
| Toast after "Copy as Prompt Context" | "Copied TASK-001 context. Paste it into your AI tool." |
| Confirm-delete message | "Delete TASK-001? This can't be undone, and the ID won't be reused." |
| Handoff toast (M7 `task-owner`) | "TASK-001 handed off to {name}." |
| Move announcement (drag/keyboard) | "TASK-001 moved to Review, position 2 of 3." |

## 6. Logo / wordmark

- **Product name:** Vibecoding Project Tracker (PRD §11)
- **Wordmark style:** The name in Atkinson Hyperlegible Next Bold, `brand-primary`, with no icon or image, so there is no logo graphic needing alt text and nothing to misread.

## 7. Out of scope (this hackathon)

To keep design tight, the following are explicitly not part of `design-done`:

- ~~A dark mode toggle.~~ Originally out of scope; added after M12 as an accessibility feature (see §2 "Dark theme" and D15). The OS high-contrast / forced-colors mode is also respected by not removing system outlines.
- Multiple themes. One brand, applied consistently.
- Animations beyond a 200 ms fade on toast notifications.
- A custom icon set. Use [Lucide icons](https://lucide.dev) (`lucide-react`); decorative icons get `aria-hidden="true"` because the text label next to them carries the meaning.

## 8. Design decision log

Each decision is tied to a usability principle (Nielsen's 10 heuristics) and/or a WCAG 2.2 criterion, as required by PRD §10.

| # | Decision | Principle / criterion |
|---|---|---|
| D1 | Type and urgency always shown as icon + text + colour, never colour alone | WCAG 1.4.1 Use of Color; Nielsen #6 Recognition rather than recall |
| D2 | Teal/magenta for task type instead of green/red | Colour-vision deficiency safety; WCAG 1.4.1 |
| D3 | All text ≥ 4.5:1 (most ≥ 7:1), borders and icons ≥ 3:1 | WCAG 1.4.3 / 1.4.6 Contrast; 1.4.11 Non-text Contrast |
| D4 | Atkinson Hyperlegible family for all text, including IDs | Low-vision and dyslexia legibility; Nielsen #8 Aesthetic and minimalist design (one family) |
| D5 | 16px body, 14px minimum, rem units, 1.5 line-height | WCAG 1.4.4 Resize Text, 1.4.10 Reflow, 1.4.12 Text Spacing |
| D6 | Tints only on urgent cards; done cards go neutral | Visual hierarchy; Nielsen #1 Visibility of system status |
| D7 | Labels give concrete times ("Due in 5h") | Nielsen #2 Match between system and the real world |
| D8 | Drag-and-drop with a keyboard/select alternative | WCAG 2.5.7 Dragging Movements, 2.1.1 Keyboard; Nielsen #7 Flexibility and efficiency |
| D9 | Thick, always-visible focus ring | WCAG 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured |
| D10 | 44px targets | WCAG 2.5.8 Target Size; Fitts's law |
| D11 | Toasts and moves announced via `aria-live` | WCAG 4.1.3 Status Messages; Nielsen #1 |
| D12 | Delete confirmation names the ticket and states consequences | Nielsen #5 Error prevention; #3 User control and freedom |
| D13 | Respect `prefers-reduced-motion` | WCAG 2.3.3 Animation from Interactions (vestibular disorders) |
| D14 | Visible labels on every form field; errors in text | WCAG 3.3.1 Error Identification, 3.3.2 Labels or Instructions; Nielsen #9 Help users recover from errors |
| D15 | Dark theme as a user choice defaulting to the OS setting, AAA contrast in both themes | WCAG 1.4.3 / 1.4.6 Contrast; Nielsen #7 Flexibility and efficiency of use; Nielsen #3 User control and freedom |

---

*DESIGN.md version: hackathon-starter v1 · filled in for `design-done` (accessibility-first)*
