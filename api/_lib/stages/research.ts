import { anthropic, MODEL, textOf, type CostTracker } from "../anthropic.js";
import type { CompanyProfile } from "./fetch.js";

export interface ResearchResult {
  summary: string;
  sources: Array<{ url: string; title: string }>;
}

export async function runResearchStage(
  domain: string,
  profile: CompanyProfile,
  cost: CostTracker,
  signal: AbortSignal,
  onDetail: (detail: string) => void,
): Promise<ResearchResult> {
  onDetail("searching for recent news, funding, and hiring signals");

  const response = await anthropic().messages.create(
    {
      model: MODEL,
      max_tokens: 1500,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }],
      system:
        "You research companies for a sales-qualification pipeline. Search for recent, " +
        "concrete signals only. Report only what the search results support; never invent. " +
        "If nothing recent is found, say so plainly.",
      messages: [
        {
          role: "user",
          content:
            `Company: ${profile.company_name} (${domain}). What they do: ${profile.what_they_do}\n\n` +
            "Find recent news, funding announcements, or hiring signals (especially sales/marketing " +
            "roles) for this company. Summarize the 2-4 most relevant findings as short bullets, " +
            "each naming its source.",
        },
      ],
    },
    { signal },
  );

  cost.add(response.usage);

  const sources: Array<{ url: string; title: string }> = [];
  const seen = new Set<string>();
  for (const block of response.content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item.type === "web_search_result" && !seen.has(item.url)) {
          seen.add(item.url);
          sources.push({ url: item.url, title: item.title ?? item.url });
        }
      }
    }
  }

  return { summary: textOf(response.content).trim(), sources: sources.slice(0, 8) };
}
