# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal site for ljr.dev, served by GitHub Pages directly from `main` (CNAME → `ljr.dev`, `.nojekyll`
disables Jekyll). The static site has no build step. A Vercel project on the same repo additionally
deploys the `api/` serverless functions (the live agent demo backend, TypeScript, `npm run build` =
`tsc --noEmit`) and serves `demo/` as its output. Both GitHub Pages and Vercel auto-deploy on push, so
pushing to `main` is the deployment.

To preview locally: `python3 -m http.server` from the repo root, then open `http://localhost:8000/`.
Open the files directly with `file://` only for a rough look: the root-absolute `/assets/...` paths
will not resolve.

## Positioning

The site's owner (Liam Jabir Roumila; "Liam Roumila" on the resume) sells two things at once, and the
copy has to serve both without picking a side:

1. **Freelance / consulting** is the primary frame. Businesses hire him to eliminate manual work and
   connect the systems they already use: automation, integrations, internal tools, AI workflows. This
   is what the home page leads with and what `/engagements/` prices.
2. **Full-time Forward Deployed Engineer / Solutions Engineer roles** are the secondary frame, carried
   by the availability line ("available for projects & full-time roles"), the "For hiring teams" card
   at the bottom of the home page's About section (which holds the resume, live demo, and GitHub
   links), and the footer. Do not delete these; they are the whole job-seeking surface.

The through-line for both: he sits with the customer, understands the operation, and ships the thing
that fixes it. Lead with evidence in problem → what I built → outcome form.

Facts and constraints:

- **Coachmake is offline.** coachmake.com no longer resolves. Present it as a case study; never link
  it, and keep the copy past tense ("ran it in production", not "operate it in production").
  AuditorsIQ (auditorsiq.com) and I Can Relate (icanrelate.co) are live and linkable.
- **No em dashes anywhere in site copy.** Use commas, colons, or separate sentences. The `·` middot
  is fine as a separator. This applies to `<meta>` descriptions and og tags too.
- Don't invent metrics, clients, testimonials, or claims. Where a number is missing, put
  `[TODO: metric]` and ask the owner.
- Identity facts: 6+ years experience, New York area, contact liam@ljr.dev, github.com/LJR230,
  linkedin.com/in/liam-j-roumila. Booking CTA: https://cal.com/ljr/intro.
- Pricing on `/engagements/` and the home page cards must stay in sync: Automation Sprint from $500,
  Business Systems Build from $2,000, Technical Partner monthly retainer.

## Files

- `index.html` — home page.
- `work/index.html` — `/work/`, six project case studies.
- `engagements/index.html` — `/engagements/`, three pricing tiers.
- `assets/site.css` — the entire stylesheet: `@font-face` rules, `:root` tokens, and component
  classes. Both other pages and every component share it.
- `assets/fonts/*.woff2` — self-hosted Schibsted Grotesk (2 subsets) and JetBrains Mono (6 subsets),
  variable-weight, extracted from the old bundler export. No external font requests on these pages.
- `assets/img/*.webp` — project screenshots.
- `assets/og.png` — 1200×630 link-preview image. `assets/favicon.svg`, `assets/apple-touch-icon.png`.
- `scripts/og.html` — the source page `assets/og.png` is rendered from; regeneration steps are in a
  comment at the top of that file.
- `demo/` — the live agent demo (plain HTML + `demo.css`), backed by `api/run.ts` on Vercel.
- `LJR_RESUME.pdf` — linked from the hero, the "For hiring teams" card, and every footer.
- `404.html` — meta-refresh + JS redirect to `/`.
- `Jabir Portfolio.html` — the pre-2026-08 design-tool export the old single-file site came from.
  Gitignored, kept locally, no longer used.

## Editing the site

These are plain static HTML files. Edit them directly; there is no build step, no bundler, and no
runtime JavaScript on any of the three pages.

- **Structure and copy** live in the HTML. Layout comes from classes in `assets/site.css`; one-off
  spacing is a `style=""` attribute on the element.
- **Tokens** (`--bg`, `--card`, `--border`, `--text`, `--body`, `--muted`, `--faint`, `--accent`, …)
  are defined once in `:root` in `assets/site.css` and mirrored in `demo/demo.css`. Change both.
  See `design.md` for what each token means and the type scale.
- **The nav, footer, and `<head>` block are duplicated across the three pages.** There is no include
  mechanism, so a change to any of them has to be made three times (four, counting `demo/`).
- **Images**: `.shot` sets `width: 100%; height: auto; aspect-ratio: 16/10; object-fit: contain`.
  `height: auto` is load-bearing — without it the intrinsic `height=""` attribute wins and
  `aspect-ratio` is ignored, which makes the boxes hundreds of pixels too tall. Keep `width`/`height`
  attributes accurate to the file, and always write real `alt` text.
- **Paths are root-absolute** (`/assets/…`, `/work/`) so the same markup works from any directory.
- After editing, check it in a browser at more than one width; `clamp()`-based type and `auto-fit`
  grids do most of the responsive work but the two-column project rows are worth re-checking.
