import { anthropic, MODEL, textOf, type CostTracker } from "../anthropic.js";
import { ICP } from "../../../config/icp.js";
import type { CompanyProfile } from "./fetch.js";
import type { ResearchResult } from "./research.js";

export interface ScoreResult {
  score: number;
  reasons: Array<{
    claim: string;
    evidence: string;
    source_url: string;
    direction: "supports" | "against" | "unknown";
  }>;
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
          direction: {
            type: "string",
            enum: ["supports", "against", "unknown"],
            description: "Whether this reason pushed the score up, down, or neither",
          },
        },
        required: ["claim", "evidence", "source_url", "direction"],
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
        "pipeline. Use this rubric:\n" +
        "- 85-100: affirmative evidence matches industry, size, AND buyer.\n" +
        "- 60-84: strong match on two criteria; the third unknown or mildly off.\n" +
        "- 40-59: evidence mixed or mostly unknown; nothing affirmatively disqualifies.\n" +
        "- 20-39: exactly one clear mismatch (e.g. far outside the size band).\n" +
        "- 0-19: multiple clear mismatches (e.g. wrong industry AND wrong buyer).\n" +
        "Missing evidence means UNKNOWN, not a disqualifier: score that criterion " +
        "neutrally, mark its reason's direction 'unknown', and never score below 20 for " +
        "thin evidence alone.\n" +
        "Every reason must cite evidence actually present in the input with its source " +
        "URL - never invent evidence. Set each reason's direction to 'supports', " +
        "'against', or 'unknown' by whether it pushed the score up, down, or neither, " +
        "and order reasons by influence, most influential first. The reasons must " +
        "collectively justify the number: a score below 40 requires at least one " +
        "'against' reason stating the concrete mismatch; a score of 70+ requires " +
        "'supports' reasons covering the core criteria.",
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
