# Sarvik — Visual Identity ("Sabha")

Sarvik is an AI constituency-intelligence dashboard for an Indian Member of
Parliament. It is a **government decision tool**, so the identity must read as
credible, authoritative, data-dense and calm — civic-tech / financial-terminal
gravitas with warmth, not a marketing landing page. The old default (violet on
white, Inter) read as generic "AI slop"; this system replaces it wholesale.

All styling flows through the shadcn CSS variables in `src/index.css` (`:root`)
and `tailwind.config.js`. Components are never restyled directly — they re-theme
automatically from these tokens.

---

## Typography

Distinctive, serious, legible pairing (Inter / Roboto / Arial / system /
Space Grotesk explicitly avoided). Loaded via Google Fonts `<link>` in
`index.html`; wired to `--font-sans` / `--font-display` and Tailwind
`fontFamily.sans` / `fontFamily.display`.

| Role | Face | Rationale |
|------|------|-----------|
| UI / body | **IBM Plex Sans** (400/500/600/700) | A humanist grotesque commissioned as an institutional voice — technical, neutral and highly legible at small sizes. Reads as engineered and official, not consumer-marketing. Ships true tabular figures for data. |
| Display / headings / wordmark | **Fraunces** (500/600/700) | An "old-style" editorial serif with soft optical detailing. Adds newspaper-of-record authority and warmth to headings, differentiating Sarvik from every sans-only AI dashboard. Applied to `h1–h3`, `.brand-text`, `.spark-wordmark`. |

**Numbers are tabular for data.** Numeric cells (`.num`, `*__value`, `*__val`,
`*__count`, `*__score`, and all `table td`) use
`font-variant-numeric: tabular-nums` + `"tnum" 1` so figures align in columns.

---

## Color

Off the cliché violet-on-white and onto a **deep ink-navy base with a single
sharp saffron accent** — an authoritative, India-appropriate palette. Navy
carries the calm institutional weight and drives CTAs/active states; saffron is
reserved for sparing emphasis (hero rule, highlights, one data-viz series);
deep emerald signals money/positive outcomes. All text pairs clear WCAG AA
(>= 4.5:1).

| Token | HSL | Hex | Use |
|-------|-----|-----|-----|
| `--background` | `40 33% 98%` | `#FBFAF6` | Warm ivory paper (not stark white) |
| `--foreground` | `213 43% 16%` | `#17253B` | Deep navy ink — ~12:1 on card |
| `--primary` | `213 58% 24%` | `#1A3560` | Deep authoritative navy — CTAs, active nav, links, ranks |
| `--primary-foreground` | `40 33% 98%` | `#FBFAF6` | Text on navy (~12:1) |
| `--secondary` / `--muted` | `210 24% 95%` | `#EEF1F5` | Cool slate surfaces, table headers |
| `--muted-foreground` | `213 14% 40%` | `#576273` | Secondary text — ~6.3:1 on white |
| `--accent` | `38 92% 92%` | `#FCEFD3` | Pale saffron tint — badges, chips, highlights |
| `--accent-foreground` | `28 78% 26%` | `#7A3E10` | Warm brown on amber tint |
| `--destructive` | `4 68% 46%` | `#C43428` | Authoritative red |
| `--success` | `158 64% 30%` | `#1C7A54` | Deep emerald — money / positive |
| `--border` / `--input` | `214 22% 88%` | `#DBE0E7` | Visible in light mode |
| `--ring` | `213 58% 24%` | `#1A3560` | Focus ring (navy) |
| `--saffron` | `38 92% 50%` | `#F5A214` | Sharp accent — hero top-rule, emphasis |

### Data-viz ramp (charts)

| Token | HSL | Hex |
|-------|-----|-----|
| `--chart-1` | `213 58% 30%` | `#204378` (navy) |
| `--chart-2` | `187 62% 34%` | `#218C9E` (teal) |
| `--chart-3` | `38 92% 50%` | `#F5A214` (saffron) |
| `--chart-4` | `213 18% 55%` | `#7686A0` (slate) |

Exposed in Tailwind as `success`, `saffron`, and `chart-1…4`. A parallel dark
theme is defined under `.dark` (the app currently ships light-only).

---

## Detail tokens

- **Radius** — reduced `0.875rem → 0.625rem` (10px) for precise, terminal-like
  gravitas instead of soft/bubbly corners.
- **Shadows** — subtle and layered (`0 1px 2px` on rest, `0 8–10px … -14px`
  navy-tinted on hover); saffron/violet glows removed and re-tied to
  `--primary`.
- **Borders** — `#DBE0E7`, clearly visible on the ivory background.
- **Background treatment** — a calm, fixed two-point radial mesh (navy ~5%,
  saffron ~4%) over warm ivory: distinctive texture that never distracts.
- **Hero** — navy gradient with a 3px saffron top-rule, replacing the flashy
  violet gradient.

## Accessibility

- All body/UI text pairs clear **>= 4.5:1** (most 6–12:1).
- Visible focus rings via `--ring` and `box-shadow` focus states on inputs.
- Interactive elements keep `cursor: pointer` and **150–300ms** transitions.
- Icons are SVG / lucide only — no emoji.
