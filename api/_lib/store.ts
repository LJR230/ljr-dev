import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const RUNS_PER_HOUR = Number(process.env.RATE_LIMIT_RUNS_PER_HOUR ?? 3);
const CACHE_TTL_S = Number(process.env.CACHE_TTL_HOURS ?? 24) * 3600;
export const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 5);
export const PER_RUN_BUDGET_USD = Number(process.env.PER_RUN_BUDGET_USD ?? 0.4);

let redis: Redis | null | undefined;
let limiter: Ratelimit | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else if (process.env.VERCEL) {
    // Deployed without a store: fail closed rather than run uncapped.
    throw new Error("Upstash env vars are required in deployed environments");
  } else {
    console.warn("[store] No Upstash config — cache/limits disabled (local dev only)");
    redis = null;
  }
  return redis;
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24);
}

export async function checkRateLimit(
  ipHash: string,
): Promise<{ allowed: boolean; retryAfterS: number }> {
  const r = getRedis();
  if (!r) return { allowed: true, retryAfterS: 0 };
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(RUNS_PER_HOUR, "1 h"),
      prefix: "demo:rl",
    });
  }
  const res = await limiter.limit(ipHash);
  return {
    allowed: res.success,
    retryAfterS: res.success ? 0 : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
  };
}

function dayKey(): string {
  return `demo:spend:${new Date().toISOString().slice(0, 10)}`;
}

export async function isDailyBudgetExceeded(): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const spent = Number((await r.get(dayKey())) ?? 0);
  return spent >= DAILY_BUDGET_USD;
}

export async function addDailySpend(usd: number): Promise<void> {
  const r = getRedis();
  if (!r || usd <= 0) return;
  const key = dayKey();
  await r.incrbyfloat(key, usd);
  await r.expire(key, 48 * 3600);
}

export async function getCachedResult(domain: string): Promise<unknown | null> {
  const r = getRedis();
  if (!r) return null;
  return await r.get(`demo:result:v3:${domain}`);
}

export async function setCachedResult(domain: string, result: unknown): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(`demo:result:v3:${domain}`, JSON.stringify(result), { ex: CACHE_TTL_S });
}

export interface RunLogEntry {
  ts: string;
  domain: string;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  searches: number;
  cost_usd: number;
  outcome: string;
  cache_hit: boolean;
}

export async function logRun(entry: RunLogEntry): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.lpush("demo:runs", JSON.stringify(entry));
    await r.ltrim("demo:runs", 0, 999);
  } catch (err) {
    console.error("[store] logRun failed", err);
  }
}
