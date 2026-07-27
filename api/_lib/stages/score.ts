import { anthropic, MODEL, textOf, type CostTracker } from "../anthropic";
import { ICP } from "../../../config/icp";
import type { CompanyProfile } from "./fetch";
import type { ResearchResult } from "./research";

export interface ScoreResult {
  score: number;
  reasons: Array<{ claim: string; evidence: string; source_url: string }>;
}

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      description: "ICP fit from 0 (no fit) to 100 (perfect fit)",
    },
    reasons: {
      type: "array",
      description: "Exactly 2-3 reasons, each grounded in provided evidence",
      items: {
        type: "object",
        properties: {
          claim: { type: "string", description: "The scoring claim, one sentence" },
          evidence: { type: "string", description: "The specific evidence supporting it" },
          source_url: { type: "string", description: "URL the evidence came from" },
        },
        required: ["claim", "evidence", "source_url"],
        additionalProperties: false,
      },
    },
  },
  required: ["score", "reasons"],
  additionalProperties: false,
} as const;

export async function runScoreStage(
  domain: string,
  profile: CompanyProfile,
  research: ResearchResult | null,
  cost: CostTracker,
  signal: AbortSignal,
  onDetail: (detail: string) => void,
): Promise<ScoreResult> {
  onDetail("scoring against the ICP");

  const researchBlock = research
    ? `<research_findings>\n${research.summary}\n\nSources:\n${research.sources
        .map((s) => `- ${s.title}: ${s.url}`)
        .join("\n")}\n</research_findings>`
    : "<research_findings>Research stage unavailable for this run; score on the website evidence only.</research_findings>";

  const response = await anthropic().messages.create(
    {
      model: MODEL,
      max_tokens: 900,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCORE_SCHEMA },
      },
      system:
        "You score companies against an Ideal Customer Profile for a sales-qualification " +
        "pipeline. Every reason must cite evidence actually present in the input, with its " +
        "source URL. If evidence is thin, score low and say why - never invent evidence. " +
        "A score above 70 requires clear evidence on industry, size, AND buyer.",
      messages: [
        {
          role: "user",
          content:
            `<icp>\n${JSON.stringify(ICP, null, 2)}\n</icp>\n\n` +
            `<company_profile domain="${domain}">\n${JSON.stringify(profile, null, 2)}\n</company_profile>\n\n` +
            `${researchBlock}\n\n` +
            "Score this company's fit with the ICP (0-100) with 2-3 evidence-backed reasons.",
        },
      ],
    },
    { signal },
  );

  cost.add(response.usage);
  const parsed = JSON.parse(textOf(response.content)) as ScoreResult;
  parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  return parsed;
}
