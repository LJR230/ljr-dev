import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-5";

// Standard Sonnet 5 list rates (USD per million tokens) and the web search fee.
// An introductory rate ($2/$10) applies through 2026-08-31; we display standard
// rates so the shown cost never understates. Update alongside model changes.
const PRICING = {
  inputPerMTok: 3,
  outputPerMTok: 15,
  cacheReadPerMTok: 0.3,
  cacheWritePerMTok: 3.75,
  webSearchPer1000: 10,
};

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic();
  }
  return client;
}

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

export class CostTracker {
  tokensIn = 0;
  tokensOut = 0;
  searches = 0;

  add(usage: UsageLike): void {
    this.tokensIn +=
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0);
    this.tokensOut += usage.output_tokens;
    this.searches += usage.server_tool_use?.web_search_requests ?? 0;
    this.costUsd +=
      (usage.input_tokens / 1e6) * PRICING.inputPerMTok +
      ((usage.cache_creation_input_tokens ?? 0) / 1e6) * PRICING.cacheWritePerMTok +
      ((usage.cache_read_input_tokens ?? 0) / 1e6) * PRICING.cacheReadPerMTok +
      (usage.output_tokens / 1e6) * PRICING.outputPerMTok +
      ((usage.server_tool_use?.web_search_requests ?? 0) / 1000) *
        PRICING.webSearchPer1000;
  }

  costUsd = 0;
}

/** Extract the concatenated text blocks from a response's content array. */
export function textOf(content: Array<{ type: string }>): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
