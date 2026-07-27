# Live Agent Demo — Implementation Plan

An embedded, publicly usable demo on ljr.dev: a visitor enters a company domain, a
visible agent pipeline researches the company, scores it against a sample ICP, and
drafts a personalized cold-email opener with cited sources and the real dollar cost
of the run.

Status: **shipped.** Live at https://ljr.dev/demo/ (static via GitHub Pages) + https://ljr-dev-pi.vercel.app (API + same-origin copy). Verified in production: full runs (commonroom.io 78, clay.com 35, ramp.com 15), cache hits, rate limiting, timeout/over-budget partials, invalid-domain rejection, CORS from ljr.dev, mobile layout, no console errors.

---

## 1. The constraint that shapes everything

ljr.dev is a static GitHub Pages site deployed from `main`. There is no server, so
there is nowhere on the current stack to hold an Anthropic API key or run the
pipeline. The demo needs a backend host.

**Recommended architecture: keep the site on GitHub Pages, add a Vercel project
for the API only.**

- The repo gains an `api/` directory (Vercel serverless functions, TypeScript) and
  a `demo/` directory (static demo page). GitHub Pages keeps serving the static
  files exactly as today; a Vercel project connected to the same repo deploys only
  the functions. Both auto-deploy on push to `main`, so "main is the deployment"
  stays true and the existing site carries zero new risk.
- The demo page calls the API cross-origin (`https://<project>.vercel.app/api/run`,
  optionally `api.ljr.dev` later). CORS on the API is locked to `https://ljr.dev`.
- Vercel Hobby (free) supports streaming responses and enough execution time for
  the 60s run budget.

Alternatives considered:
- **Move the whole site to Vercel** — cleaner single deploy, but requires moving
  DNS and re-platforming a working site for no user-visible gain. Can be done
  later without rework; the API code doesn't change.
- **Cloudflare Workers** — also viable and free, but Vercel's git integration and
  Node runtime make the DX simpler for a repo this small.

**State store: Upstash Redis (free tier)** for the domain cache, per-IP rate
limits, the global daily budget counter, and the run log. It's serverless-native
(REST API, no connection pooling issues), and one store covers all four needs.

Prerequisites the owner must do (I can't):
1. Create a Vercel account/project connected to the GitHub repo (root directory:
   repo root; framework: "Other"; no build output override needed).
2. Create an Upstash Redis database (or add the Upstash integration in Vercel).
3. Set env vars in Vercel (list in §7).
4. Fix git push auth on this machine (still broken — nothing can deploy until
   `git push` works).

---

## 2. Repo layout after implementation

```
api/
  run.ts              POST /api/run — the SSE pipeline endpoint
  _lib/
    pipeline.ts       stage orchestration (explicit steps, not one mega-prompt)
    stages/
      fetch.ts        stage 1: fetch & read company site
      research.ts     stage 2: web-search research
      score.ts        stage 3: ICP scoring
      opener.ts       stage 4: opener draft
    anthropic.ts      client, model id, pricing table, cost accounting
    domain.ts         input validation/normalization + SSRF guards
    store.ts          Upstash: cache, rate limit, daily cap, run log
    sse.ts            SSE event encoding helpers
config/
  icp.ts              the sample ICP (swap-friendly, plain data)
demo/
  index.html          demo page (vanilla HTML/CSS/JS, matches site style)
  demo.js             input, stream rendering, result card, error states
  demo.css
  examples.json       pre-cached results for the "try an example" button
scripts/
  seed-examples.ts    runs the pipeline for 2–3 domains, writes examples.json
docs/
  agent-demo-plan.md  this file (§8 becomes the config/ops README)
package.json          deps + `npm run build` (typecheck) + `npm run seed`
tsconfig.json
vercel.json           function config (maxDuration 60, region)
```

The existing `index.html` gets one small addition: a "Live demo" link in the
hero/nav pointing at `/demo/` (edited via the established template-string
procedure in CLAUDE.md).

## 3. Agent pipeline

Model: `claude-sonnet-5` for every stage (Sonnet-class per spec; $3/$15 per MTok,
intro $2/$10 through 2026-08-31). All calls server-side via `@anthropic-ai/sdk`.
Each stage is a separate, explicit API call orchestrated in `pipeline.ts`; stages
2–4 receive the prior stages' structured outputs as input. Stage prompts request
low effort (`output_config: {effort: "low"}`) — this is a latency-sensitive demo,
not deep reasoning.

1. **fetch** — Normalize the domain, resolve DNS and reject private/loopback
   ranges (SSRF), fetch `https://<domain>/` with a 10s timeout, ≤3 redirects
   (re-checking each hop), 2 MB cap. Parse same-origin links for `/about` and
   `/careers`, fetch up to 2 extra pages. Strip HTML to text, cap ~20k chars.
   One Sonnet call with structured output → `{ what_they_do, size_signals,
   positioning, icp_relevant_facts[] }`, each fact tagged with its source URL.
2. **research** — One Sonnet call with the `web_search_20260209` server tool
   (`max_uses: 2`) asking for recent news, funding, or hiring signals. Citations
   from the search result blocks become the source list. Structured summary out.
3. **score** — One Sonnet call: ICP from `config/icp.ts` + stage 1/2 outputs →
   structured `{ score: 0-100, reasons: [{ claim, evidence, source_url }] }`
   (2–3 reasons, each tied to actual evidence; the prompt forbids inventing
   facts not present in the inputs).
4. **opener** — One Sonnet call → `{ opener, claims: [{ text, source_url }] }`.
   2–3 sentences, must reference a specific researched detail, prompt explicitly
   bans generic flattery.

Sample ICP (in `config/icp.ts`, trivially swappable):
B2B SaaS · 11–200 employees · sells to sales/marketing teams · US-based.

**Cost accounting:** every response's `usage` (input/output/cache tokens) is
accumulated; web searches are counted from `server_tool_use` blocks. A pricing
table in `anthropic.ts` (token rates + per-search fee, verified against the
pricing docs at implementation time) converts to dollars. The final SSE `result`
event carries the total in dollars — displaying unit cost is part of the demo.
Estimated cost per uncached run: **~$0.08–0.12** (≈17k input + ≈2k output tokens
+ 2–3 searches).

## 4. API + streaming

Single endpoint: `POST /api/run` with `{ domain }`. Response is a streamed SSE
body (`text/event-stream`); the client uses `fetch` + a `ReadableStream` reader
(EventSource can't POST). Events:

```
stage_start   { stage, label }
stage_update  { stage, detail }          — brief live detail ("found /careers", "searching news…")
stage_done    { stage, summary, usage }
result        { score, reasons, opener, claims, sources, cost_usd, cached, partial }
error         { code, message }          — codes: invalid_domain | unreachable | rate_limited | demo_paused | timeout | upstream
done          {}
```

- **60s hard timeout** via one run-level `AbortController`; on timeout the stages
  completed so far are emitted as a `result` with `partial: true`.
- A late-stage failure likewise degrades to a partial result (e.g. research fails
  → score runs on stage-1 evidence only, noted in the result).
- Responses of cached runs replay the same event shape instantly, `cached: true`,
  `cost_usd: 0`.

## 5. Cost controls (hard, layered)

| Layer | Mechanism |
|---|---|
| Per-stage | `max_tokens` caps per call; `max_uses: 2` on web search |
| Per-run | Running cost tally; hard abort if projected > `PER_RUN_BUDGET_USD` (default $0.25) |
| Per-IP | 3 runs/hour (sliding window, `@upstash/ratelimit`, keyed on salted SHA-256 of IP) |
| Global daily | Redis counter of $ spent per UTC day; over `DAILY_BUDGET_USD` (default $5) → API returns `demo_paused`, client switches to cached-examples-only mode |
| Cache | Result cached by normalized domain, 24h TTL — repeat lookups are free and instant |
| Timeout | 60s AbortController, partial results |

**Run log:** every run appends `{ ts, domain, duration_ms, tokens_in, tokens_out,
searches, cost_usd, outcome, cache_hit }` to a Redis list (capped at last 1,000),
reviewable from the Upstash console — no admin endpoint to secure.

## 6. Demo UI

`demo/index.html` — vanilla HTML/CSS/JS, no framework, no client build step.
Styled to match the site: `#0b0c0e` background, JetBrains Mono for labels/chips,
`#4ADE80` accent, same card idiom as the project cards. Mobile-first layout.

- Input: single domain field + Run button. Client-side pre-validation mirrors the
  server's (server remains authoritative).
- Pipeline view: four stage rows that fill in live (name, spinner/check/cross,
  one-line detail) as SSE events arrive.
- Result card: fit score with the 2–3 evidence-backed reasons, the opener with
  per-claim source attribution, source links, and the run cost in dollars
  (e.g. "this run cost $0.09").
- Errors render as friendly states per error code; `rate_limited` and
  `demo_paused` both surface the "try an example" path.
- "Try an example": 2–3 buttons backed by `demo/examples.json` (generated by
  `npm run seed`, committed) — instant, zero-backend, works even if the API is
  down or capped.
- Main site gets a "Live demo" link. The demo positions itself explicitly as a
  GTM-engineering artifact ("the kind of enrichment/scoring pipeline I build").

## 7. Configuration (becomes the ops README on completion)

Env vars (set in Vercel; `.env.local` for local dev, gitignored):

| Var | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | server-side only, never in client code | — |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | state store | — |
| `ALLOWED_ORIGIN` | CORS allowlist | `https://ljr.dev` |
| `PER_RUN_BUDGET_USD` | hard per-run abort threshold | `0.25` |
| `DAILY_BUDGET_USD` | global daily cap → cached-only mode | `5` |
| `RATE_LIMIT_RUNS_PER_HOUR` | per-IP | `3` |
| `IP_HASH_SALT` | salts hashed IPs in rate-limit keys/logs | — |
| `CACHE_TTL_HOURS` | domain result cache | `24` |

- **ICP**: edit `config/icp.ts` (plain object: industry, size band, buyer, geo).
- **Pricing**: token/search rates in `api/_lib/anthropic.ts`; update if model or
  pricing changes.
- **Examples**: `npm run seed -- acme.com stripe.com ramp.com` regenerates
  `demo/examples.json` (requires local env vars).
- Local dev: `vercel dev` (functions + static together).

Proposed dependencies (**approval required before install**):
runtime `@anthropic-ai/sdk`, `@upstash/redis`, `@upstash/ratelimit`, `zod`;
dev `typescript`, `@types/node`, `vercel`.

## 8. Implementation plan

Phase 0 — prerequisites (owner)
- [x] Approve this plan, hosting choice, and dependency list
- [x] Fix git push auth; create Vercel project + Upstash DB; set env vars

Phase 1 — scaffolding
- [x] `package.json`, `tsconfig.json`, `vercel.json`; `npm run build` = `tsc --noEmit`
- [x] `.gitignore` additions (`node_modules`, `.env*`, `.vercel`)
- [x] `config/icp.ts`, pricing table, env parsing (zod-validated)

Phase 2 — backend pipeline
- [x] `domain.ts`: normalization, validation, SSRF guards (+ unit-testable pure functions)
- [x] Stage 1 fetch & read (fetch hardening + extraction call)
- [x] Stage 2 research (web search tool, citation collection)
- [x] Stage 3 score, Stage 4 opener (structured outputs)
- [x] `pipeline.ts` orchestration: SSE events, cost tally, 60s abort, partial results
- [x] `store.ts`: cache, rate limit, daily cap, run log
- [x] `run.ts` endpoint: CORS, method/body validation, wiring

Phase 3 — frontend
- [x] `demo/` page: input, live stage view, result card, error states, mobile
- [x] `examples.json` seeding script + "try an example" flow
- [x] "Live demo" link in the main site template

Phase 4 — verification & ship
- [x] `npm run build` clean; local end-to-end via `vercel dev` on real domains
- [x] Verify: rate limit, daily-cap mode, cache hit, timeout/partial path, bad domains, mobile layout, no console errors
- [x] Seed examples, update this doc's §7 as the final README section
- [x] Merge `agent-demo` → `main`, push, verify on the deployed site
- [x] Report tradeoffs + hardening list

## 9. Known tradeoffs (upfront)

- Vercel Hobby is non-commercial-use tier; fine for a portfolio demo.
- Per-IP limiting is defeatable via VPN rotation — the global daily cap is the
  real spend ceiling.
- SSE over serverless means no resume on disconnect; acceptable for a 60s demo.
- `sonnet-5` everywhere keeps quality consistent; stage 1 extraction could run on
  Haiku 4.5 (~3× cheaper) at some quality cost — not done by default, flag if
  cost review says otherwise.
- Cached results may be up to 24h stale; the result card will show "cached" state.

## 10. Post-launch notes (verified in production)

- Run cost observed: $0.06-0.25 per fresh run; per-run cap raised to $0.40.
  Over-budget and timeout now degrade to partial results instead of erroring.
- Research stage is capped at 40s (run cap 75s); heavy domains (apollo.io)
  can still skip research and degrade gracefully.
- Vercel project deploys via CLI (`npx vercel deploy --prod`), not git
  integration — pushes to `main` update ljr.dev (GitHub Pages) but NOT the
  API. Either connect the repo in Vercel's dashboard (Settings -> Git) or
  keep deploying via CLI after API changes.
- `vercel env pull` masks sensitive values as `[SENSITIVE]` — local runs
  against production credentials aren't possible; test through the API.
- Additional hardening candidates: web-search count sometimes reports 0
  (usage field inconsistency; slightly understates displayed cost), research
  source extraction missed result blocks on one run (ramp.com example shows
  1 source), examples could be re-seeded periodically for freshness.
