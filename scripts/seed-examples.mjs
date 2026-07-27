#!/usr/bin/env node
// Seeds demo/examples.json by running the pipeline through the real API.
// Usage: SEED_API_URL=https://<project>.vercel.app npm run seed -- acme.com stripe.com
// Defaults to http://localhost:3000 (start with `npm run dev` / `vercel dev`).

import { writeFile } from "node:fs/promises";

const apiBase = (process.env.SEED_API_URL || "http://localhost:3000").replace(/\/$/, "");
const domains = process.argv.slice(2);

if (domains.length === 0) {
  console.error("Usage: npm run seed -- <domain> [domain...]");
  process.exit(1);
}

async function runOne(domain) {
  console.log(`[seed] running ${domain} via ${apiBase} ...`);
  const res = await fetch(`${apiBase}/api/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${domain}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let error = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const chunk of parts) {
      let event = null;
      const dataLines = [];
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (event === "result") result = JSON.parse(dataLines.join("\n"));
      if (event === "error") error = JSON.parse(dataLines.join("\n"));
      if (event === "stage_done") {
        const d = JSON.parse(dataLines.join("\n"));
        console.log(`  - ${d.stage} ${d.failed ? "FAILED" : "done"}`);
      }
    }
  }

  if (error) throw new Error(`${domain}: ${error.code} - ${error.message}`);
  if (!result) throw new Error(`${domain}: stream ended without a result`);
  if (result.partial) console.warn(`  ! ${domain} produced a partial result`);
  return result;
}

const examples = [];
for (const domain of domains) {
  try {
    examples.push(await runOne(domain));
  } catch (err) {
    console.error(`[seed] ${err.message}`);
  }
}

if (examples.length === 0) {
  console.error("[seed] nothing succeeded; examples.json left unchanged");
  process.exit(1);
}

await writeFile(
  new URL("../demo/examples.json", import.meta.url),
  JSON.stringify({ examples }, null, 2) + "\n",
);
console.log(`[seed] wrote demo/examples.json with ${examples.length} example(s)`);
