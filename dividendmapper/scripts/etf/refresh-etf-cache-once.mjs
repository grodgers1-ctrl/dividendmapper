// ETF Lane Task 3.5 - Local smoke for the refresh-etf-cache cron.
//
// Loads .env.local (so it works in PowerShell without a preamble) then loops
// POSTs against the chunked route on http://localhost:3000 until the queue is
// drained. Each call processes up to CHUNK_SIZE stalest tickers. We stop only
// when a chunk returns fewer than requested AND the route didn't hit its soft
// deadline - otherwise "processed < CHUNK" could be a deadline-bailed chunk
// with more work still pending.
//
//   node dividendmapper/scripts/etf/refresh-etf-cache-once.mjs
//
// Requires `npm run dev` already running in another terminal. Env knobs:
//   CHUNK_SIZE     (default 10)   - tickers per HTTP call; matches Vercel cron
//   REFRESH_HOST   (default http://localhost:3000)
//   CRON_SECRET    (required, from .env.local)

import { readFileSync } from "node:fs";

const envPath = new URL("../../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const SECRET = process.env.CRON_SECRET;
if (!SECRET) {
  console.error("CRON_SECRET missing");
  process.exit(1);
}

const CHUNK = Number(process.env.CHUNK_SIZE ?? 10);
const HOST = process.env.REFRESH_HOST ?? "http://localhost:3000";
const URL_BASE = `${HOST}/api/internal/refresh-etf-cache`;

let round = 0;
let totalProcessed = 0;
const allErrors = [];

while (true) {
  round++;
  console.log(`\n--- round ${round} (limit=${CHUNK}) ---`);
  const r = await fetch(`${URL_BASE}?limit=${CHUNK}`, {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}` },
  });
  if (!r.ok) {
    console.error(`HTTP ${r.status}: ${await r.text()}`);
    process.exit(1);
  }
  const out = await r.json();
  console.log(
    `  processed=${out.processed} infoOk=${out.infoOk} holdingsOk=${out.holdingsOk} sectorOk=${out.sectorOk} countryOk=${out.countryOk} durationMs=${out.durationMs} deadlineHit=${out.deadlineHit}`,
  );
  if (out.errors?.length) {
    console.warn(`  errors (${out.errors.length}):`);
    out.errors.forEach((e) => console.warn(`    ${e}`));
    allErrors.push(...out.errors);
  }
  const processed = out.processed ?? 0;
  const deadlineHit = out.deadlineHit === true;
  totalProcessed += processed;
  if (processed < CHUNK && !deadlineHit) {
    // genuinely drained - chunk returned fewer without deadline pressure
    break;
  }
  if (processed === 0) {
    // poison-ticker guard: zero processed AND deadline hit means a single
    // ticker burned the whole budget. Avoid infinite loop.
    console.error(
      "Zero processed with deadlineHit - poison ticker stuck at head of queue. Stopping.",
    );
    break;
  }
  if (round > 50) {
    console.error("Safety stop: 50 rounds reached");
    break;
  }
}

console.log(
  `\nTOTAL: ${totalProcessed} tickers processed across ${round} round(s). ${allErrors.length} error(s).`,
);
