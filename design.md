# ljr.dev design system

This documents the visual system shared by the two surfaces of the site, plus the findings
of a design audit (see bottom). The two surfaces are:

- **Portfolio** (`index.html`, served at `ljr.dev`) — bundler export, all styles inline in the
  `__bundler/template` string. See CLAUDE.md for editing constraints.
- **Agent demo** (`demo/`, served at `ljr.dev/demo/`) — plain HTML + `demo.css`, tokens as
  CSS custom properties in `:root`.

The demo's `:root` variables are the canonical token names. The portfolio uses the same hex
values inline. When changing a token, update both surfaces.

## Principles

- Dark, quiet, engineering-flavored. One accent color doing all the signaling work.
- Monospace (JetBrains Mono) is the "system voice": labels, kickers, metadata, tags, code-ish
  facts. The sans face is the "human voice": headlines and prose.
- Uppercase + letter-spacing + muted color marks a label; content next to it is brighter.
- Hierarchy comes from text color steps on one dark background, not from boxes and shadows.
  Cards are subtle: one shade above the background with a 1px border.
- No gradients, no shadows, no decorative imagery. Motion is limited to a pulse on the
  demo's running pipeline stage and smooth scrolling on the portfolio.

## Color tokens

| Token (demo var) | Hex | Role |
|---|---|---|
| `--bg` | `#0B0C0E` | Page background, both surfaces |
| `--card` | `#121417` | Card / input / chip fill, image placeholder fill |
| `--border` | `#1D2024` | Default 1px border, section dividers (`border-top`) |
| `--border-soft` | `#2A2E33` | Stronger border: input borders, link underlines, avatar ring |
| `--text` | `#E8EAED` | Headings, primary text, light button fill |
| `--body` | `#B7BCC2` | Body / paragraph text |
| `--muted` | `#9BA1A8` | Secondary text, section headings (mono), inactive links |
| `--faint` | `#6E747B` | Tertiary labels ("WHAT I BUILT:", block labels, placeholders) |
| `--accent` | `#4ADE80` | The accent: availability dot, project links, demo CTA, score, citations |
| `--danger` | `#F87171` | Demo only: failed stage, low score, error box |

Portfolio-only intermediate grays (no demo equivalent yet): `#C6CBD1` (skill chip text,
about text, footer links), `#8B9096` (project meta lines, footer base), `#23272C` (stack
tag pill border). Demo-only hardcoded values: `#FBBF24` (mid score), `#08110B` (text on
accent button).

The accent is a prop on the portfolio's dynamic component (`data-props`): default `#4ADE80`,
options `#FBBF24`, `#22D3EE`, `#A78BFA`. The demo hardcodes `--accent: #4ade80`; if the
portfolio accent ever changes, change it in `demo.css` too.

Selection color (portfolio): `rgba(255,255,255,0.16)`.

## Typography

**Families**

- `'Schibsted Grotesk', system-ui, sans-serif` — portfolio headings and prose. Embedded as
  woff2 in the bundler manifest, weights 400/500/600/700/800.
- `'JetBrains Mono', monospace` — labels, metadata, tags, links-as-metadata on both
  surfaces. Portfolio embeds 400/500/600; demo loads 400/500 from Google Fonts.
- The demo currently has **no sans webfont**: `--sans` is the system stack. Its h1 renders
  in the platform UI font, not Schibsted Grotesk (see audit finding 2).

**Scale**

| Use | Size | Weight / treatment |
|---|---|---|
| Portfolio h1 | `clamp(44px, 8vw, 84px)` | 800, `-0.03em`, line-height 1.02 |
| Demo h1 | `clamp(28px, 6vw, 40px)` | 800, `-0.02em` |
| Project title (h3) | 24px | 700, `-0.01em` |
| Result company | 19px | 700 |
| Hero lede | `clamp(18px, 2.4vw, 22px)` | body color |
| About prose | `clamp(17px, 2.2vw, 20px)` | `#C6CBD1`, line-height 1.6 |
| Body / descriptions | 15–16px | `--body` |
| Meta lines, buttons | 14–15px | 600 on buttons |
| Mono UI text | 12.5–13.5px | links, tags, stage names |
| Mono labels | 11–12px | 500, uppercase, `letter-spacing: 0.05–0.08em`, `--faint`/`--muted` |

Base line-height: 1.5 (portfolio) / 1.55 (demo). Long prose uses `text-wrap: pretty`.

**The label pattern** (the site's most recognizable motif): JetBrains Mono, ~11.5–13px,
uppercase, letter-spacing 0.08em, in `--muted` (section headings) or `--faint` (inline
labels like "WHAT I BUILT:", "COLD-EMAIL OPENER"). Lowercase mono in `--muted`/`--accent`
is the variant for kickers and the availability line.

## Layout and spacing

- Containers: portfolio `max-width: 1020px`; demo `max-width: 720px` (narrower on purpose,
  it is a single-column tool page). Horizontal padding: `clamp(20px, 5vw, 48px)` portfolio,
  20px demo.
- Sections are separated by `border-top: 1px solid var(--border)` plus generous vertical
  padding (`clamp(40px, 7vh, 80px)`), not by background changes.
- Project rows: `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` so image and
  text sit side by side and stack on mobile; 56px gap between projects.
- Common gaps: 8/10px chip gaps, 12–20px within components, 28–56px between blocks.

## Radii

- `8px` — buttons, inputs, skill chips
- `10px` — project screenshots
- `12px` — demo cards (pipeline, result, error box)
- `99px`/`999px` — tag and badge pills
- `50%` — avatar, dots

## Components

- **Primary button (portfolio)**: 46px tall, `#E8EAED` fill, dark text, 600, radius 8.
  Secondary: transparent, `1px solid --border-soft`. Hover brightens fill / border.
- **Primary button (demo)**: accent fill, near-black text (`#08110B`), mono 14px/500,
  radius 8. Hover `filter: brightness(1.08)`, disabled at 0.45 opacity. Note this differs
  from the portfolio's primary (audit finding 3).
- **Metadata link**: mono 13px, `--muted`, `text-decoration: none`, underline drawn as
  `border-bottom: 1px solid --border-soft`; hover raises color to `--text`/white. Used for
  hero links and footer. Content links inside demo results use `--accent` with hover
  underline instead.
- **Tag pill**: mono 12px, `--muted` on transparent, 1px border, radius 99px. Skill chips
  are the squarer sibling: mono 13.5px, `--card` fill, radius 8, `padding: 8px 14px`.
- **Card (demo)**: `--card` fill, `1px solid --border`, radius 12.
- **Pipeline stage (demo)**: 9px dot + mono stage name + truncated detail. States: pending
  (faint name), running (accent dot, 1s opacity pulse), done (accent dot), failed
  (`--danger` dot).
- **Score (demo)**: mono 38px/500 number in accent; `#FBBF24` mid, `--danger` low;
  uppercase mono label beneath.
- **Opener quote (demo)**: `border-left: 2px solid --accent`, 14px inset, `--text`.
- **Error box (demo)**: danger at 35% border / 6% fill, radius 12.

---

## Audit findings (2026-07-27)

### High

1. **The portfolio is invisible to crawlers and link previews.** The outer shell of
   `index.html` has a `<title>` and nothing else: no meta description, no Open Graph or
   Twitter tags, no favicon, and the real content only exists after the bootstrap script
   rebuilds the document. Sharing ljr.dev in Slack/LinkedIn/iMessage produces a blank
   card, and search engines that don't execute the loader see an empty page. Fix in the
   outer shell `<head>` (it is plain HTML, safe to edit directly): add a description, OG
   tags with a static preview image, and a favicon. The demo has a description but also
   lacks OG tags and favicon.

2. **`--faint` (#6E747B) fails WCAG AA where it is used.** At ~4.1:1 on the page background
   and ~3.9:1 on cards, it is below the 4.5:1 requirement for small text, and it is used
   almost exclusively at 11–12.5px (block labels, "WHAT I BUILT:", stage details, score
   label, input placeholder, footer text). Bumping it to around `#7E858D` (~5:1) preserves
   the look and passes. All other grays pass (`#8B9096` ≈ 6:1, `--muted` ≈ 7:1).

### Medium

3. **The two surfaces disagree on fonts and primary buttons.** The demo's headings render
   in the system UI font because it never loads Schibsted Grotesk, so the h1 changes
   typeface when navigating from ljr.dev to /demo/. Its primary button is accent-filled
   while the portfolio's is white-filled. Both are one-line fixes: add Schibsted Grotesk
   700/800 to the demo's Google Fonts request and set `--sans` to match; pick one primary
   button treatment (suggestion: accent = "run/do something" actions, white = navigation
   CTAs, and note the rule here).

4. **Focus visibility on the demo form.** `#domain-input` sets `outline: none` and signals
   focus only by recoloring a 1px border to accent, which is easy to miss; the example
   chips and run button rely on the browser default ring against a dark background. Add
   explicit `:focus-visible` styles (e.g. 2px accent outline with offset) to input,
   buttons, and chips.

5. **Screenshot images may lack alt text.** Project screenshots are `<image-slot>` custom
   elements with `placeholder` labels but no visible `alt`/`aria-label` in the template.
   Whether the dc-runtime injects alt text is unverified; check the rendered DOM and add
   labels if missing.

### Low

6. **Token drift between surfaces.** Demo hardcodes `#FBBF24` (mid score) and `#08110B`
   (button text) instead of variables; the portfolio's stack-tag border `#23272C` and grays
   `#C6CBD1`/`#8B9096` have no demo token; the demo accent will silently diverge if the
   portfolio's accent prop is switched. Cosmetic, but this file is now the sync point.

7. **Mono size proliferation.** Eight mono sizes between 11 and 14.5px (11, 11.5, 12, 12.5,
   13, 13.5, 14, 14.5). Consolidating to ~4 steps (11.5 / 12.5 / 13.5 / 14.5) would tighten
   the system without visible change.

8. **Font delivery differs.** The portfolio embeds fonts; the demo fetches from Google
   Fonts (extra origin, layout shift risk, third-party request). Consider self-hosting the
   demo's fonts, especially if finding 3 adds Schibsted Grotesk.

9. **Page weight.** `index.html` is ~336KB in one file (base64 webp screenshots + fonts).
   Acceptable for a portfolio and it is a single request, but recompressing the three
   screenshots at slightly lower quality is the first lever if it grows.

### What already works well

The palette is genuinely shared (demo vars match portfolio hexes exactly), the mono-label
motif is applied consistently on both surfaces, spacing is generous and consistent, the
demo's pipeline states (pending/running/done/failed) are a clean extension of the system,
and both pages handle mobile deliberately (clamp-based type, auto-fit grids, the demo's
score reflow under 480px).
