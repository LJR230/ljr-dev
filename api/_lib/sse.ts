import type { ServerResponse } from "node:http";

export type ErrorCode =
  | "invalid_domain"
  | "unreachable"
  | "rate_limited"
  | "demo_paused"
  | "over_budget"
  | "timeout"
  | "upstream";

export class SseWriter {
  private heartbeat: NodeJS.Timeout;
  private closed = false;
  private res: ServerResponse;

  constructor(res: ServerResponse) {
    this.res = res;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    this.heartbeat = setInterval(() => {
      if (!this.closed) this.res.write(":hb\n\n");
    }, 15000);
  }

  event(type: string, data: unknown): void {
    if (this.closed) return;
    this.res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  error(code: ErrorCode, message: string): void {
    this.event("error", { code, message });
  }

  end(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.heartbeat);
    this.res.write(`event: done\ndata: {}\n\n`);
    this.res.end();
  }
}
