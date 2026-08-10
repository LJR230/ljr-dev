# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal portfolio site for ljr.dev, served by GitHub Pages directly from `main` (CNAME → `ljr.dev`, `.nojekyll` disables Jekyll). The static site has no build step. A Vercel project on the same repo additionally deploys the `api/` serverless functions (the live agent demo backend, TypeScript, `npm run build` = `tsc --noEmit`) and serves `demo/` as its output. Both GitHub Pages and Vercel auto-deploy on push, so pushing to `main` is the deployment.

To preview locally: `python3 -m http.server` from the repo root, or open `index.html` in a browser (it requires JavaScript to render).

## Positioning

The site's owner (Liam Jabir Roumila; "Liam Roumila" on the resume) is positioning himself for **Forward Deployed Engineer / Solutions Engineer** roles at AI/SaaS startups: an engineer who builds production integrations and deploys them into customers' environments and workflows (embed snippets on customers' own websites, webhook-driven event capture, live debugging in environments he didn't control). All copy changes should reinforce that identity rather than a generic "full-stack engineer" or GTM-engineer one. Concretely:

- Lead with the customer-facing engineering evidence, in problem → what I built → outcome form: the Coachmake attribution system (embed snippet on coaches' own sites, custom UTM event schema, Adjust SDK, canonical click-ID join key, debugged live in customer-controlled environments), the Coachmake coach-facing AI recommendation engine (Claude Sonnet 4.5 proposing program changes that a coach approves or rejects; changes apply only on coach approval), the Python cuisine classifier, AuditorsIQ, and I Can Relate (contract work directly with a non-technical founder).
- Coachmake is offline: present it as a case study, never link to it as a live site. AuditorsIQ (auditorsiq.com) is live and linkable.
- Style rule: no em dashes anywhere in site copy; use commas, colons, or separate sentences. Don't invent metrics, clients, testimonials, or claims; where a number is missing, put `[TODO: metric]` and ask the owner.
- Identity facts: 6+ years experience, New York based, contact liam@ljr.dev. Titles and the availability line say Forward Deployed Engineer / solutions engineering, not GTM.

## Files

- `index.html` — the entire site, a self-contained ~336KB single-file export (see below).
- `Jabir Portfolio.html` — the original export from the design tool; gitignored, kept locally as the source artifact. `index.html` is the deployable copy of it.
- `LJR_RESUME.pdf` — linked from the page's "resume" anchor via `<a href="LJR_RESUME.pdf" download>`.
- `404.html` — meta-refresh + JS redirect to `/`.

## Architecture of index.html

The file is NOT plain HTML you can edit directly in the visible markup. It is a bundler export with three layers:

1. **Bootstrap loader** — an inline `<script>` near the top that, at page load, reads the two special script tags below, decompresses resources, rewrites resource references to blob URLs, and replaces the whole document with the real page.
2. **`<script type="__bundler/manifest">`** — a JSON map of UUID → resource, each gzip+base64 encoded: the `dc-runtime` JS, an `<image-slot>` scaffold JS, and JetBrains Mono woff2 fonts.
3. **`<script type="__bundler/template">`** — the real page HTML, stored as one giant JSON-encoded string (escaped `\n`, `\"`, `\u002F`). This is where all visible markup and copy lives.

Inside the template, the page is a "dynamic component": an `<x-dc>` element containing the markup, plus a `<script type="text/x-dc">` defining `class Component extends DCLogic` whose `renderVals()` returns the content data — the project list (Coachmake, AuditorsIQ, I Can Relate), skill groups, the accent color, and a `showAvailability` flag. Project screenshots are inline `data:image/webp;base64,...` URIs inside that data. The `data-props` attribute on that script tag declares the editable props (accent color options, showAvailability).

## Editing the site

- Text/content changes go inside the `__bundler/template` string in `index.html`. Because the template is a JSON string, any edit must preserve its escaping: newlines are `\n`, quotes are `\"`, and slashes in closing tags are unicode-escaped (a closing script tag appears as `<\u002Fscript>`). Small copy edits work fine with exact-string `Edit` on the escaped text; for anything structural, decode the string with Python (`json.loads` on the tag's contents), modify, re-encode with `json.dumps`, and write it back.
- Content data (projects, skills, links) lives in the `renderVals()` return value of the `text/x-dc` script within the template — prefer editing there over hunting through markup.
- The `<title>` appears twice: once in the outer shell `<head>` and once in the template's `<helmet>` block — change both.
- After editing, verify the page still renders in a browser: a JSON-escaping mistake silently breaks the loader and leaves the loading placeholder on screen.
