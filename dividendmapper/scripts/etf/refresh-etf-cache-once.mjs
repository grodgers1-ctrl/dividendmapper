// ETF Lane Task 3.5 - One-shot local smoke for the refresh-etf-cache cron.
// Loads .env.local (so it works in PowerShell without a preamble) then POSTs
// the route on http://localhost:3000 with the bearer token.
//
//   node dividendmapper/scripts/etf/refresh-etf-cache-once.mjs
//
// Requires `npm run dev` already running in another terminal. The script just
// fires the request and prints status + body. No orchestration.

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

const r = await fetch("http://localhost:3000/api/internal/refresh-etf-cache", {
  method: "POST",
  headers: { authorization: `Bearer ${SECRET}` },
});
console.log(r.status, await r.text());
