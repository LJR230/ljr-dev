import { anthropic, MODEL, textOf, type CostTracker } from "../anthropic.js";
import { htmlToText, safeFetch, FetchGuardError } from "../domain.js";

export interface CompanyProfile {
  company_name: string;
  what_they_do: string;
  size_signals: string;
  positioning: string;
  facts: Array<{ fact: string; source_url: string }>;
}

export interface FetchStageResult {
  profile: CompanyProfile;
  pages: string[];
}

const PAGE_TIMEOUT_MS = 10000;
const MAX_BYTES = 2 * 1024 * 1024;
const EXTRA_PATHS = /href\s*=\s*["']([^"']*\/(?:about|about-us|company|careers)\/?)["']/gi;

const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    company_name: { type: "string" },
    what_they_do: { type: "string", description: "1-2 sentences on the product/service" },
    size_signals: {
      type: "string",
      description: "Evidence about company size (team page, careers volume, customers). 'unknown' if none.",
    },
    positioning: { type: "string", description: "Who they sell to and how they position" },
    facts: {
      type: "array",
      description: "3-6 specific facts useful for ICP qualification, each tied to the page it came from",
      items: {
        type: "object",
        properties: {
          fact: { type: "string" },
          source_url: { type: "string" },
        },
        required: ["fact", "source_url"],
        additionalProperties: false,
      },
    },
  },
  required: ["company_name", "what_they_do", "size_signals", "positioning", "facts"],
  additionalProperties: false,
} as const;

export async function runFetchStage(
  domain: string,
  cost: CostTracker,
  signal: AbortSignal,
  onDetail: (detail: string) => void,
): Promise<FetchStageResult> {
  onDetail(`fetching https://${domain}/`);
  let home;
  try {
    home = await safeFetch(`https://${domain}/`, {
      timeoutMs: PAGE_TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      signal,
    });
  } catch (err) {
    if (err instanceof FetchGuardError) throw err;
    throw new FetchGuardError("unreachable", `Could not fetch ${domain}`);
  }
  if (home.status >= 400) {
    throw new FetchGuardError("unreachable", `${domain} returned HTTP ${home.status}`);
  }

  const pages: Array<{ url: string; text: string }> = [
    { url: home.url, text: htmlToText(home.body, 14000) },
  ];

  // Discover up to 2 same-site about/careers pages.
  const seen = new Set<string>();
  for (const m of home.body.matchAll(EXTRA_PATHS)) {
    if (seen.size >= 2) break;
    let target: URL;
    try {
      target = new URL(m[1], home.url);
    } catch {
      continue;
    }
    if (!target.hostname.endsWith(domain.replace(/^www\./, ""))) continue;
    const key = target.pathname.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      onDetail(`reading ${target.pathname}`);
      const extra = await safeFetch(target.toString(), {
        timeoutMs: PAGE_TIMEOUT_MS,
        maxBytes: MAX_BYTES,
        signal,
      });
      if (extra.status < 400) {
        pages.push({ url: extra.url, text: htmlToText(extra.body, 6000) });
      }
    } catch {
      // Extra pages are best-effort.
    }
  }

  onDetail(`extracting profile from ${pages.length} page${pages.length > 1 ? "s" : ""}`);
  const pagesBlock = pages
    .map((p) => `<page url="${p.url}">\n${p.text}\n</page>`)
    .join("\n\n");

  const response = await anthropic().messages.create(
    {
      model: MODEL,
      max_tokens: 1200,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: PROFILE_SCHEMA },
      },
      system:
        "You extract company intelligence from website text for a sales-qualification pipeline. " +
        "Use only information present in the provided pages. Never invent facts.",
      messages: [
        {
          role: "user",
          content:
            `Company domain: ${domain}\n\n${pagesBlock}\n\n` +
            "Extract the company profile. For each fact, source_url must be one of the page URLs above.",
        },
      ],
    },
    { signal },
  );

  cost.add(response.usage);
  const profile = JSON.parse(textOf(response.content)) as CompanyProfile;
  return { profile, pages: pages.map((p) => p.url) };
}
