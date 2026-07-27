import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizeDomain } from "./_lib/domain.js";
import { SseWriter } from "./_lib/sse.js";
import { runPipeline, PipelineError, type RunResult } from "./_lib/pipeline.js";
import {
  addDailySpend,
  checkRateLimit,
  getCachedResult,
  hashIp,
  isDailyBudgetExceeded,
  logRun,
  setCachedResult,
} from "./_lib/store.js";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "https://ljr.dev";
const LOCAL_ORIGINS = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function setCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && (origin === ALLOWED_ORIGIN || LOCAL_ORIGINS.test(origin))) {
    res.setHeader("access-control-allow-origin", origin);
  }
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-max-age", "86400");
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  // Vercel may have pre-parsed the body; fall back to reading the stream.
  const maybe = (req as IncomingMessage & { body?: unknown }).body;
  if (maybe !== undefined && maybe !== null) {
    return typeof maybe === "string" ? JSON.parse(maybe) : maybe;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > 4096) throw new Error("body too large");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "POST only" }));
    return;
  }

  let domainInput = "";
  try {
    const body = (await readJsonBody(req)) as { domain?: unknown };
    domainInput = typeof body.domain === "string" ? body.domain : "";
  } catch {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "invalid JSON body" }));
    return;
  }

  const sse = new SseWriter(res);
  const startedAt = Date.now();

  const domain = normalizeDomain(domainInput);
  if (!domain) {
    sse.error("invalid_domain", "That doesn't look like a valid company domain.");
    sse.end();
    return;
  }

  try {
    // Cache hit: free, instant, no rate-limit charge.
    const cached = (await getCachedResult(domain)) as RunResult | null;
    if (cached) {
      sse.event("result", { ...cached, cached: true, cost_usd: 0 });
      sse.end();
      await logRun(runLog(domain, startedAt, cached, "ok", true));
      return;
    }

    if (await isDailyBudgetExceeded()) {
      sse.error(
        "demo_paused",
        "The demo hit its daily budget cap. Try one of the cached examples, or come back tomorrow.",
      );
      sse.end();
      return;
    }

    const rl = await checkRateLimit(hashIp(clientIp(req)));
    if (!rl.allowed) {
      sse.error(
        "rate_limited",
        `Rate limit reached (a few runs per hour per visitor). Try again in ~${Math.ceil(rl.retryAfterS / 60)} min, or use a cached example.`,
      );
      sse.end();
      return;
    }

    const result = await runPipeline(domain, sse);
    sse.event("result", result);
    sse.end();

    await Promise.allSettled([
      setCachedResult(domain, result),
      addDailySpend(result.cost_usd),
      logRun(runLog(domain, startedAt, result, result.partial ? "partial" : "ok", false)),
    ]);
  } catch (err) {
    const [code, message] =
      err instanceof PipelineError
        ? [err.code, publicMessage(err)]
        : (["upstream", "Something went wrong running the pipeline."] as const);
    sse.error(code, message);
    sse.end();
    console.error("[run] failed", domain, err);
    const spent = err instanceof PipelineError ? err.costUsd : 0;
    await Promise.allSettled([
      addDailySpend(spent),
      logRun({
        ...runLog(domain, startedAt, null, `error:${code}`, false),
        cost_usd: Number(spent.toFixed(4)),
      }),
    ]);
  }
}

function publicMessage(err: PipelineError): string {
  switch (err.code) {
    case "invalid_domain":
      return "That domain can't be analyzed.";
    case "unreachable":
      return "Couldn't reach that site. Check the domain and try again.";
    case "over_budget":
      return "This run exceeded its cost budget and was stopped.";
    case "timeout":
      return "The run hit the 60s time limit before producing results.";
    default:
      return "Something went wrong running the pipeline.";
  }
}

function runLog(
  domain: string,
  startedAt: number,
  result: RunResult | null,
  outcome: string,
  cacheHit: boolean,
) {
  return {
    ts: new Date().toISOString(),
    domain,
    duration_ms: Date.now() - startedAt,
    tokens_in: result?.tokens_in ?? 0,
    tokens_out: result?.tokens_out ?? 0,
    searches: result?.searches ?? 0,
    cost_usd: cacheHit ? 0 : (result?.cost_usd ?? 0),
    outcome,
    cache_hit: cacheHit,
  };
}
