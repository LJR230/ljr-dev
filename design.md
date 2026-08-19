# ljr.dev design system

This documents the visual system shared by the two surfaces of the site. The two surfaces are:

- **Site** (`index.html`, `estate-planning/index.html`, `immigration/index.html`,
  `how-i-work/index.html`, served at `ljr.dev`) — plain static HTML, all styling in
  `assets/site.css`, tokens as CSS custom properties in `:root`.
- **Agent demo** (`demo/`, served at `ljr.dev/demo/`, no longer linked from the site) — plain HTML +
  `demo.css`, same token names in its own `:root`.

The two `:root` blocks must be kept in sync by hand. When changing a token, update both.

## Principles

- Dark, quiet, engineering-flavored. One accent color doing all the signaling work.
- Monospace (JetBrains Mono) is the "system voice": labels, kickers, metadata, tags, prices, code-ish
  facts. The sans face (Schibsted Grotesk) is the "human voice": headlines and prose.
- Uppercase + letter-spacing + muted color marks a label; content next to it is brighter.
- Hierarchy comes from text color steps on one dark background, not from boxes and shadows. Cards are
  subtle: one shade above the background with a 1px border.
- No gradients, no shadows, no decorative imagery. Motion is limited to a pulse on the demo's running
  pipeline stage, 0.15s color transitions on buttons, smooth scrolling, and the home page's node
  network (below).
- **Node-network background (home only, `assets/net.js`)**: a fixed canvas behind the content drawing
  ~90 drifting nodes in `--muted` at 0.18–0.43 opacity, 1px links under 150px apart at ≤0.1 opacity,
  with depth-based scroll parallax. Within 220px of the cursor, nodes and links render in `--accent`
  and nodes are gently repelled. It must stay texture: grey by default, accent only under the cursor,
  and skipped under `prefers-reduced-motion`.

## Color tokens

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0B0C0E` | Page background, both surfaces |
| `--card` | `#121417` | Card / input / chip fill, screenshot letterbox fill |
| `--border` | `#1D2024` | Default 1px border, section dividers (`border-top`) |
| `--border-soft` | `#2A2E33` | Stronger border: secondary button, link underlines |
| `--border-tag` | `#23272C` | Tag pill border (site only) |
| `--text` | `#E8EAED` | Headings, primary text, primary button fill |
| `--bright` | `#C6CBD1` | Long prose, skill chip text, pattern cards (site only) |
| `--body` | `#B7BCC2` | Body / paragraph text |
| `--muted` | `#9BA1A8` | Secondary text, section kickers, inactive nav links |
| `--dim` | `#8B9096` | Footer text and links (site only) |
| `--faint` | `#7E858D` | Tertiary labels ("WHAT I BUILT:", step numbers, `//` notes) |
| `--accent` | `#4ADE80` | Availability dot, project links, prices, demo CTA, score, citations |
| `--danger` | `#F87171` | Demo only: failed stage, low score, error box |

Demo-only hardcoded values that have no token yet: `#FBBF24` (mid score), `#08110B` (text on the
accent button).

Selection color: `rgba(255,255,255,0.16)`. Focus ring: `2px solid var(--accent)` at `2px` offset, on
every link and button.

## Typography

**Families**

- `'Schibsted Grotesk', system-ui, -apple-system, sans-serif` — headings and prose.
- `'JetBrains Mono', ui-monospace, monospace` — labels, metadata, tags, prices, links-as-metadata.

The site self-hosts both as variable woff2 in `assets/fonts/` (Schibsted Grotesk: latin, latin-ext;
JetBrains Mono: latin, latin-ext, greek, cyrillic, cyrillic-ext, vietnamese), declared with
`font-weight: 400 800` / `400 600` ranges and `unicode-range` subsetting, so only the latin files load
for English text. The latin file of each is `<link rel="preload">`ed. The demo still fetches both
families from Google Fonts; self-hosting it too would remove the last third-party request.

**Scale**

| Use | Class | Size | Weight / treatment |
|---|---|---|---|
| Home h1 | `.h1` | `clamp(44px, 8vw, 84px)` | 800, `-0.03em`, line-height 1.02 |
| Sub-page h1 | `.h1.h1--page` | `clamp(36px, 6vw, 60px)` | 800, line-height 1.05 |
| Section h2 | `.h2` | `clamp(26px, 4vw, 36px)` | 700, `-0.01em` |
| CTA h2 | `.h2--cta` | `clamp(28px, 4.5vw, 42px)` | 800, `-0.02em` |
| Project title | `.h3` | 24px | 700, `-0.01em` |
| Hero lede | `.lede` | `clamp(18px, 2.4vw, 22px)` | `--body` |
| Long prose | `.prose` | `clamp(17px, 2.2vw, 20px)` | `--bright`, line-height 1.6 |
| Body | `.body` / `.body-sm` | 15px / 14.5px | `--body` / `--muted`, line-height 1.55 |
| Buttons | `.btn` | 15px | 600, 46px tall |
| Mono UI text | — | 12.5–14.5px | links, tags, prices, chips |
| Mono labels | `.kicker` / `.label` | 12px / 11.5px | 500, uppercase, `0.08em`, `--muted` / `--faint` |

Base line-height 1.5 (site) / 1.55 (demo). Headings use `text-wrap: balance`, paragraphs
`text-wrap: pretty`.

**The label pattern** (the site's most recognizable motif): JetBrains Mono, 11.5–12px, uppercase,
letter-spacing 0.08em, in `--muted` (`.kicker`, section headings) or `--faint` (`.label`, inline
labels like "WHAT I BUILT:"). Lowercase mono in `--muted`/`--accent` is the variant for the
availability line, page kickers, and `//` asides.

## Layout and spacing

- `.wrap`: `max-width: 1020px`, horizontal padding `clamp(20px, 5vw, 48px)`. The demo uses 720px on
  purpose, it is a single-column tool page.
- `.section`: separated by `border-top: 1px solid var(--border)` plus `clamp(40px, 7vh, 80px)`
  vertical padding, not by background changes. `.section--cta` pads to `clamp(56px, 9vh, 90px)`.
- `.grid`: `repeat(auto-fit, minmax(300px, 1fr))`, 32px/40px gap, `align-items: start`. Variants:
  `.grid--center` (centered rows), `.grid--tight` (280px, 14px gap), `.grid--steps` (180px, 28px/24px).
- Project rows on `/work/` are 56px apart; the home page's proof rows 48px.
- Common gaps: 8/10px chip gaps, 12–20px within components, 28–56px between blocks.

## Radii

- `8px` — buttons, inputs, skill chips
- `10px` — project screenshots
- `12px` — cards
- `99px`/`999px` — tag and badge pills
- `50%` — dots

## Components

- **Primary button** (`.btn--primary`): 46px tall, `--text` fill, dark text, 600, radius 8; hover to
  pure white. Used for navigation and booking CTAs on the site.
- **Secondary button** (`.btn--secondary`): transparent, `1px solid --border-soft`; hover brightens
  the border.
- **Demo primary button**: accent fill, near-black text (`#08110B`), mono 14px/500, radius 8. The
  split is deliberate: accent = "run something", white = navigate / book.
- **Metadata link** (`.metalink`): mono 13px, `--muted`, underline drawn as
  `border-bottom: 1px solid --border-soft`; hover raises the color. Used for hero links and footers.
- **Content link** (`.textlink`) and **site link** (`.sitelink`): `--accent`, hover to `#86EFAC`.
- **Tag pill** (`.tag`): mono 12px, `--muted` on transparent, 1px `--border-tag`, radius 99px. Skill
  chips (`.chip`) are the squarer sibling: mono 13.5px, `--card` fill, radius 8, padding 8px 14px.
- **Card** (`.card`): `--card` fill, `1px solid --border`, radius 12. As a link it brightens its
  border on hover.
- **Screenshot** (`.shot`): 16/10 box, `object-fit: contain` against the `--card` fill, radius 10,
  1px border. `height: auto` is required or the `height=""` attribute defeats `aspect-ratio`.
- **Architecture diagram** (`.diagram`, architecture pages): `--card` fill, 1px `--border`, radius
  12, `overflow-x: auto` with a thin `--border-soft` scrollbar thumb; the inline SVG inside has
  `min-width: 720px` (load-bearing: without it the SVG shrinks instead of scrolling on phones).
  Diagram boxes are `--bg` fill with 1px `--border-soft` stroke (accent stroke at 0.55 opacity marks
  the pipeline's core component); solid `--faint` arrows are automated flow, dashed arrows and
  dashed boxes are manual steps or logging satellites. All diagram text is mono via
  `style="font-family: var(--mono)"`; captions use `.diagram-caption` (mono 12.5px `--faint`, `//`
  prefix).
- **Pipeline stage (demo)**: 9px dot + mono stage name + truncated detail. States: pending (faint
  name), running (accent dot, 1s opacity pulse), done (accent dot), failed (`--danger` dot).
- **Score (demo)**: mono 38px/500 number in accent; `#FBBF24` mid, `--danger` low; uppercase mono
  label beneath.
- **Opener quote (demo)**: `border-left: 2px solid --accent`, 14px inset, `--text`.
- **Error box (demo)**: danger at 35% border / 6% fill, radius 12.

---

## Audit findings

Findings from the 2026-07-27 audit, and where they stand after the 2026-08-13 rebuild.

### Resolved

1. ~~**The portfolio is invisible to crawlers and link previews.**~~ The three pages are now plain
   static HTML with no bootstrap loader, and each has a description, canonical URL, Open Graph and
   Twitter tags, a shared 1200×630 preview image (`assets/og.png`), and an SVG favicon plus
   apple-touch-icon. The demo got the same head block.
2. ~~**`--faint` (#6E747B) fails WCAG AA.**~~ Bumped to `#7E858D` (~5:1) on both surfaces.
3. ~~**Screenshot images may lack alt text.**~~ Every `.shot` is a real `<img>` with descriptive
   `alt`, `loading="lazy"`, `decoding="async"`, and accurate intrinsic dimensions.
4. ~~**Page weight.**~~ The old 336KB single-file `index.html` is gone. Markup, CSS, fonts, and
   screenshots are separate cacheable files, and the fonts are shared across all pages.
5. **Focus visibility** — `:focus-visible` now draws a 2px accent outline at 2px offset on every link
   and button across the site. The demo's `#domain-input` still signals focus only by recoloring its
   1px border; add an explicit rule there.
6. **Font mismatch between surfaces** — the demo now loads Schibsted Grotesk and sets `--sans` to it,
   so headings no longer change typeface when navigating from ljr.dev to /demo/.

### Open

7. **Token drift between surfaces.** Two `:root` blocks are still maintained by hand. The demo
   hardcodes `#FBBF24` and `#08110B`; the site's `--bright`, `--dim`, and `--border-tag` have no demo
   equivalent.
8. **Mono size proliferation.** Eight mono sizes between 11 and 14.5px. Consolidating to ~4 steps
   (11.5 / 12.5 / 13.5 / 14.5) would tighten the system without visible change.
9. **Font delivery differs.** The site self-hosts; the demo still fetches from Google Fonts (extra
   origin, layout shift risk, third-party request). The woff2 files it needs are already in
   `assets/fonts/`.
10. **No shared layout.** The nav, footer, and `<head>` block are copy-pasted across three pages, so
    every change to them is a three-place edit. Fine at this size; the first thing to fix if a fourth
    page appears.
