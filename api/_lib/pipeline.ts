import { CostTracker } from "./anthropic.ts";
import { FetchGuardError } from "./domain.ts";
import type { SseWriter } from "./sse.ts";
import { PER_RUN_BUDGET_USD } from "./store.ts";
import { runFetchStage, type FetchStageResult } from "./stages/fetch.ts";
import { runResearchStage, type ResearchResult } from "./stages/research.ts";
import { runScoreStage, type ScoreResult } from "./stages/score.ts";
import { runOpenerStage, type OpenerResult } from "./stages/opener.ts";

const RUN_TIMEOUT_MS = 60000;

export interface RunResult {
  domain: string;
  company_name: string | null;
  score: number | null;
  reasons: ScoreResult["reasons"];
  opener: string | null;
  claims: OpenerResult["claims"];
  sources: Array<{ url: string; title: string }>;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  searches: number;
  cached: boolean;
  partial: boolean;
  notes: string[];
  generated_at: string;
}

export type PipelineErrorCode =
  | "invalid_domain"
  | "unreachable"
  | "over_budget"
  | "timeout"
  | "upstream";

export class PipelineError extends Error {
  code: PipelineErrorCode;

  constructor(code: PipelineErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const STAGES = [
  { id: "fetch", label: "Fetch & read" },
  { id: "research", label: "Research" },
  { id: "score", label: "ICP scoring" },
  { id: "opener", label: "Opener draft" },
] as const;

export function stageList(): Array<{ id: string; label: string }> {
  return STAGES.map((s) => ({ ...s }));
}

/**
 * Run the four-stage pipeline, emitting SSE progress. Stage 1 failure is fatal;
 * later failures degrade to a partial result. Throws PipelineError only when
 * there is nothing at all to show.
 */
export async function runPipeline(domain: string, sse: SseWriter): Promise<RunResult> {
  const cost = new CostTracker();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(new Error("run timeout")), RUN_TIMEOUT_MS);
  const notes: string[] = [];

  let fetched: FetchStageResult | null = null;
  let research: ResearchResult | null = null;
  let score: ScoreResult | null = null;
  let opener: OpenerResult | null = null;

  const timedOut = (): boolean => abort.signal.aborted;

  const checkBudget = (): void => {
    if (cost.costUsd > PER_RUN_BUDGET_USD) {
      abort.abort(new Error("over budget"));
      throw new PipelineError("over_budget", "Run exceeded its cost budget");
    }
  };

  const stage = async <T>(
    id: (typeof STAGES)[number]["id"],
    fn: (onDetail: (d: string) => void) => Promise<T>,
  ): Promise<T> => {
    const label = STAGES.find((s) => s.id === id)!.label;
    sse.event("stage_start", { stage: id, label });
    const before = { in: cost.tokensIn, out: cost.tokensOut, usd: cost.costUsd };
    const result = await fn((detail) => sse.event("stage_update", { stage: id, detail }));
    sse.event("stage_done", {
      stage: id,
      usage: {
        tokens_in: cost.tokensIn - before.in,
        tokens_out: cost.tokensOut - before.out,
        cost_usd: Number((cost.costUsd - before.usd).toFixed(4)),
      },
    });
    checkBudget();
    return result;
  };

  try {
    // Stage 1 — fatal on failure.
    try {
      fetched = await stage("fetch", (d) =>
        runFetchStage(domain, cost, abort.signal, d),
      );
    } catch (err) {
      if (timedOut()) throw new PipelineError("timeout", "Run timed out");
      if (err instanceof PipelineError) throw err;
      if (err instanceof FetchGuardError) {
        throw new PipelineError(err.code, err.message);
      }
      throw new PipelineError("upstream", "Company site analysis failed");
    }

    // Stages 2-4 — degrade to partial.
    try {
      research = await stage("research", (d) =>
        runResearchStage(domain, fetched!.profile, cost, abort.signal, d),
      );
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      if (timedOut()) return finish();
      notes.push("Web research was unavailable for this run; results use website evidence only.");
      sse.event("stage_done", { stage: "research", failed: true });
    }

    try {
      score = await stage("score", (d) =>
        runScoreStage(domain, fetched!.profile, research, cost, abort.signal, d),
      );
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      if (timedOut()) return finish();
      notes.push("ICP scoring failed for this run.");
      sse.event("stage_done", { stage: "score", failed: true });
    }

    try {
      opener = await stage("opener", (d) =>
        runOpenerStage(domain, fetched!.profile, research, score, cost, abort.signal, d),
      );
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      if (timedOut()) return finish();
      notes.push("Opener drafting failed for this run.");
      sse.event("stage_done", { stage: "opener", failed: true });
    }

    return finish();
  } finally {
    clearTimeout(timer);
  }

  function finish(): RunResult {
    if (!fetched) throw new PipelineError("timeout", "Run timed out before any results");
    const partial = !(research && score && opener);
    if (timedOut() && partial) {
      notes.push("The run hit the 60s time limit; showing what completed.");
    }
    const sources = new Map<string, string>();
    for (const p of fetched.pages) sources.set(p, p);
    for (const s of research?.sources ?? []) sources.set(s.url, s.title);
    return {
      domain,
      company_name: fetched.profile.company_name ?? null,
      score: score?.score ?? null,
      reasons: score?.reasons ?? [],
      opener: opener?.opener ?? null,
      claims: opener?.claims ?? [],
      sources: [...sources.entries()].map(([url, title]) => ({ url, title })),
      cost_usd: Number(cost.costUsd.toFixed(4)),
      tokens_in: cost.tokensIn,
      tokens_out: cost.tokensOut,
      searches: cost.searches,
      cached: false,
      partial,
      notes,
      generated_at: new Date().toISOString(),
    };
  }
}
