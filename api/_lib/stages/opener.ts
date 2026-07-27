import { anthropic, MODEL, textOf, type CostTracker } from "../anthropic.js";
import type { CompanyProfile } from "./fetch.js";
import type { ResearchResult } from "./research.js";
import type { ScoreResult } from "./score.js";

export interface OpenerResult {
  opener: string;
  claims: Array<{ text: string; source_url: string }>;
}

const OPENER_SCHEMA = {
  type: "object",
  properties: {
    opener: {
      type: "string",
      description: "The 2-3 sentence cold-email opener",
    },
    claims: {
      type: "array",
      description: "Each factual claim used in the opener, mapped to its source URL",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          source_url: { type: "string" },
        },
        required: ["text", "source_url"],
        additionalProperties: false,
      },
    },
  },
  required: ["opener", "claims"],
  additionalProperties: false,
} as const;

export async function runOpenerStage(
  domain: string,
  profile: CompanyProfile,
  research: ResearchResult | null,
  score: ScoreResult | null,
  cost: CostTracker,
  signal: AbortSignal,
  onDetail: (detail: string) => void,
): Promise<OpenerResult> {
  onDetail("drafting a personalized opener");

  const response = await anthropic().messages.create(
    {
      model: MODEL,
      max_tokens: 700,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: OPENER_SCHEMA },
      },
      system:
        "You write cold-email openers for a sales-qualification pipeline. Rules: 2-3 " +
        "sentences. Reference at least one specific, researched detail about the company. " +
        "No generic flattery ('impressive growth', 'love what you're doing'). No fake " +
        "familiarity. Plain, direct language a real SDR would send. Every factual claim " +
        "must come from the provided evidence and be listed in claims with its source URL.",
      messages: [
        {
          role: "user",
          content:
            `<company_profile domain="${domain}">\n${JSON.stringify(profile, null, 2)}\n</company_profile>\n\n` +
            (research
              ? `<research_findings>\n${research.summary}\nSources:\n${research.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}\n</research_findings>\n\n`
              : "") +
            (score
              ? `<icp_scoring>\n${JSON.stringify(score, null, 2)}\n</icp_scoring>\n\n`
              : "") +
            "Draft the opener.",
        },
      ],
    },
    { signal },
  );

  cost.add(response.usage);
  return JSON.parse(textOf(response.content)) as OpenerResult;
}
