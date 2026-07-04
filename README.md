# ljr.dev

Personal portfolio site. A single self-contained `index.html` — no build step, no dependencies.

## Files

- `index.html` — the site (self-unpacking single-file bundle)
- `404.html` — redirects any unknown path back to `/`
- `CNAME` — tells GitHub Pages to serve at `ljr.dev`
- `.nojekyll` — skips GitHub Pages' Jekyll build
- `Jabir Portfolio.html` — original source export (gitignored, kept locally)

## Deploy (GitHub Pages)

1. Create an empty repo on GitHub (e.g. `ljr-dev`), then push:

   ```sh
   git remote add origin git@github.com:<your-username>/ljr-dev.git
   git push -u origin main
   ```

2. On GitHub: **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `/ (root)` → Save.
   The custom domain field should auto-fill to `ljr.dev` from the `CNAME` file.

3. At your DNS provider for `ljr.dev`, add:

   | Type  | Name | Value                  |
   |-------|------|------------------------|
   | A     | @    | 185.199.108.153        |
   | A     | @    | 185.199.109.153        |
   | A     | @    | 185.199.110.153        |
   | A     | @    | 185.199.111.153        |
   | AAAA  | @    | 2606:50c0:8000::153    |
   | AAAA  | @    | 2606:50c0:8001::153    |
   | AAAA  | @    | 2606:50c0:8002::153    |
   | AAAA  | @    | 2606:50c0:8003::153    |
   | CNAME | www  | `<your-username>.github.io` |

4. Back in **Settings → Pages**, wait for the DNS check to pass, then tick
   **Enforce HTTPS**. This is required: `.dev` is an HSTS-preloaded TLD, so
   browsers refuse plain HTTP — the site will not load until the certificate
   is issued (usually a few minutes, up to ~1 hour).

After that, every `git push` to `main` redeploys the site.

## Alternatives

The site is static, so any static host works with zero config changes:

- **Cloudflare Pages**: create a Pages project from this repo, add `ljr.dev` as a custom domain (easiest if DNS is already on Cloudflare).
- **Netlify / Vercel**: import the repo, no build command, output directory `/`, add the custom domain in the dashboard.

(`CNAME` and `.nojekyll` are GitHub Pages-specific and harmlessly ignored elsewhere.)
