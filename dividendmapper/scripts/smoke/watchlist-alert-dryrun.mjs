// Watchlist-alert cron dry-run harness (Phase 3.5).
//
// Seeds an ISOLATED synthetic ticker (ZZWLTEST) that a real Pro user watches but
// does not hold, with two equity_score_history rows that straddle the risk
// threshold. Running the send-score-alerts cron should then produce one digest
// whose "On your watchlist" section names the ticker.
//
//   node scripts/smoke/watchlist-alert-dryrun.mjs inspect  <email>
//   node scripts/smoke/watchlist-alert-dryrun.mjs seed     <email>
//   node scripts/smoke/watchlist-alert-dryrun.mjs teardown
//
// Everything it writes is removed by `teardown`, which restores the user's prior
// watchlist_alert preference exactly (captured at seed time).

import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TICKER = "ZZWLTEST";
const STATE_FILE = new URL("./.wl-dryrun-state.json", import.meta.url);

// --- load .env.local (no dotenv dependency) ---
const envPath = new URL("../../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("missing Supabase env");
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function isoDateOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function findUser(email) {
  const { data, error } = await sb
    .from("profiles")
    .select("id, email, tier")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function inspect(email) {
  const user = await findUser(email);
  console.log("profile:", user ?? "(none)");
  if (!user) return;
  const { data: prefs } = await sb
    .from("notification_preferences")
    .select("event_type, enabled, threshold_value")
    .eq("user_id", user.id);
  console.log("notification_preferences:", prefs);
  const { data: tracked } = await sb
    .from("tracked_tickers")
    .select("ticker, source")
    .eq("user_id", user.id);
  console.log("tracked_tickers:", tracked);
  const { data: holds } = await sb
    .from("holdings")
    .select("ticker")
    .eq("user_id", user.id)
    .is("archived_at", null);
  console.log("active holdings tickers:", (holds ?? []).map((h) => h.ticker));
  const { data: score } = await sb.from("equity_scores").select("ticker").eq("ticker", TICKER);
  console.log(`synthetic ${TICKER} present in equity_scores:`, (score ?? []).length > 0);
}

async function seed(email) {
  const user = await findUser(email);
  if (!user) throw new Error(`no profile for ${email}`);
  if (!user.tier || user.tier === "free") throw new Error(`user tier is '${user.tier}', cron needs Pro+`);

  // Capture the prior watchlist_alert pref so teardown restores it exactly.
  const { data: prior } = await sb
    .from("notification_preferences")
    .select("event_type, enabled, threshold_value")
    .eq("user_id", user.id)
    .eq("event_type", "watchlist_alert")
    .maybeSingle();

  // 1. Synthetic current snapshot (cron reads ticker + data_quality).
  await sb.from("equity_scores").upsert(
    { ticker: TICKER, risk_score: 81, buy_score: 60, data_quality: "full", name: "Watchlist Smoke Test" },
    { onConflict: "ticker" },
  );

  // 2. Two history rows straddling the default risk threshold (75): 70 -> 81.
  await sb.from("equity_score_history").upsert(
    [
      { ticker: TICKER, observed_at: isoDateOffset(-1), risk_score: 70, buy_score: 60 },
      { ticker: TICKER, observed_at: isoDateOffset(0), risk_score: 81, buy_score: 60 },
    ],
    { onConflict: "ticker,observed_at" },
  );

  // 3. User watches it (and must not hold it — synthetic, so they won't).
  await sb.from("tracked_tickers").upsert(
    { user_id: user.id, ticker: TICKER, source: "manual" },
    { onConflict: "user_id,ticker" },
  );

  // 4. Enable the watchlist alert.
  await sb.from("notification_preferences").upsert(
    { user_id: user.id, event_type: "watchlist_alert", enabled: true, threshold_value: null, updated_at: new Date().toISOString() },
    { onConflict: "user_id,event_type" },
  );

  writeFileSync(STATE_FILE, JSON.stringify({ userId: user.id, email, ticker: TICKER, priorWatchlistPref: prior ?? null }, null, 2));
  console.log("seeded:", { userId: user.id, email, ticker: TICKER, priorWatchlistPref: prior ?? null });
  console.log("Now POST the cron, then run: node scripts/smoke/watchlist-alert-dryrun.mjs teardown");
}

async function teardown() {
  if (!existsSync(STATE_FILE)) {
    console.log("no state file; nothing to tear down");
    return;
  }
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  await sb.from("tracked_tickers").delete().eq("user_id", state.userId).eq("ticker", state.ticker);
  await sb.from("equity_score_history").delete().eq("ticker", state.ticker);
  await sb.from("equity_scores").delete().eq("ticker", state.ticker);

  if (state.priorWatchlistPref) {
    await sb.from("notification_preferences").upsert(
      { user_id: state.userId, event_type: "watchlist_alert", enabled: state.priorWatchlistPref.enabled, threshold_value: state.priorWatchlistPref.threshold_value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,event_type" },
    );
    console.log("restored prior watchlist_alert pref");
  } else {
    await sb.from("notification_preferences").delete().eq("user_id", state.userId).eq("event_type", "watchlist_alert");
    console.log("removed watchlist_alert pref (none existed before)");
  }
  rmSync(STATE_FILE);
  console.log("teardown complete; removed synthetic ticker + state file");
}

const [cmd, email] = process.argv.slice(2);
if (cmd === "inspect") await inspect(email);
else if (cmd === "seed") await seed(email);
else if (cmd === "teardown") await teardown();
else {
  console.error("usage: inspect <email> | seed <email> | teardown");
  process.exit(1);
}
