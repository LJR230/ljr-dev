import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const BLOCKED_TLDS = new Set(["local", "internal", "test", "invalid", "localhost", "home", "lan", "corp"]);

/**
 * Normalize free-form input ("https://www.Acme.com/pricing?x=1") to a bare
 * registrable-looking domain ("www.acme.com"). Returns null for anything that
 * is not a plausible public DNS name.
 */
export function normalizeDomain(input: string): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  if (s.length === 0 || s.length > 300) return null;
  // Reject control chars and whitespace inside the value.
  if (/[\s\u0000-\u001f\u007f]/.test(s)) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // protocol
  s = s.replace(/^[^@/]*@/, ""); // userinfo
  s = s.split(/[/?#]/)[0]; // path/query/fragment
  s = s.replace(/:\d+$/, ""); // port
  s = s.replace(/\.+$/, ""); // trailing dots
  if (s.length === 0 || s.length > 253) return null;
  if (isIP(s) || /^\[/.test(s)) return null; // no IP literals
  const labels = s.split(".");
  if (labels.length < 2) return null;
  if (!labels.every((l) => LABEL.test(l))) return null;
  const tld = labels[labels.length - 1];
  if (!/^(xn--[a-z0-9-]{2,}|[a-z]{2,})$/.test(tld)) return null;
  if (BLOCKED_TLDS.has(tld)) return null;
  return s;
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => acc * 256 + Number(o), 0) >>> 0;
}

function inCidr4(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
];

export function isPublicAddress(addr: string): boolean {
  const family = isIP(addr);
  if (family === 4) {
    return !PRIVATE_V4.some(([base, bits]) => inCidr4(addr, base, bits));
  }
  if (family === 6) {
    const a = addr.toLowerCase();
    if (a === "::" || a === "::1") return false;
    // unique-local fc00::/7, link-local fe80::/10
    if (/^f[cd]/.test(a) || /^fe[89ab]/.test(a)) return false;
    // IPv4-mapped ::ffff:a.b.c.d
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return true;
  }
  return false;
}

/** Resolve a hostname and reject it unless every returned address is public. */
export async function assertPublicHost(hostname: string): Promise<void> {
  let records;
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new FetchGuardError("unreachable", `DNS lookup failed for ${hostname}`);
  }
  if (records.length === 0) {
    throw new FetchGuardError("unreachable", `No DNS records for ${hostname}`);
  }
  for (const r of records) {
    if (!isPublicAddress(r.address)) {
      throw new FetchGuardError("invalid_domain", `${hostname} resolves to a non-public address`);
    }
  }
}

export class FetchGuardError extends Error {
  code: "invalid_domain" | "unreachable";

  constructor(code: "invalid_domain" | "unreachable", message: string) {
    super(message);
    this.code = code;
  }
}

export interface SafeFetchResult {
  url: string;
  status: number;
  body: string;
}

/**
 * Fetch a URL with SSRF guards: public-DNS check on every hop, manual redirect
 * following (max 3), response size cap, and a timeout. http/https only.
 * Note: DNS is checked immediately before each request; a DNS-rebinding TOCTOU
 * window remains (documented in the hardening list).
 */
export async function safeFetch(
  url: string,
  opts: { timeoutMs: number; maxBytes: number; signal?: AbortSignal },
): Promise<SafeFetchResult> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new FetchGuardError("unreachable", `Invalid URL: ${current}`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new FetchGuardError("invalid_domain", `Blocked protocol: ${parsed.protocol}`);
    }
    if (isIP(parsed.hostname) || /^\[/.test(parsed.hostname)) {
      throw new FetchGuardError("invalid_domain", "IP-literal URLs are not allowed");
    }
    await assertPublicHost(parsed.hostname);

    const timeout = AbortSignal.timeout(opts.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal,
        headers: {
          "user-agent": "ljr-dev-agent-demo/1.0 (+https://ljr.dev/demo/)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      throw new FetchGuardError("unreachable", `Fetch failed for ${current}`);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new FetchGuardError("unreachable", "Redirect without location");
      current = new URL(loc, current).toString();
      continue;
    }

    const body = await readCapped(res, opts.maxBytes);
    return { url: current, status: res.status, body };
  }
  throw new FetchGuardError("unreachable", "Too many redirects");
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, merged.length - off);
    merged.set(c.subarray(0, take), off);
    off += take;
    if (off >= merged.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/** Crude but dependency-free HTML → text extraction. */
export function htmlToText(html: string, maxChars: number): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'");
  s = s
    .replace(/[ \t]+/g, " ")
    .replace(/ ([.,;:!?])/g, "$1")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return s.slice(0, maxChars);
}
