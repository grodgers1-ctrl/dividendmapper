#!/usr/bin/env node
// Daily traffic report — queries PostHog HogQL, emails via Gmail SMTP
// Run from repo root: node dividendmapper/scripts/reports/daily-traffic.mjs
// Lives under dividendmapper/ so the bare `nodemailer` import resolves
// against dividendmapper/node_modules.

import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createTransport } from 'nodemailer';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(envPath) {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// Resolve .env.local regardless of cwd. __dirname is dividendmapper/scripts/reports,
// so ../../.env.local is dividendmapper/.env.local.
const envCandidates = [
  process.env.DOTENV_PATH,
  resolve(__dirname, '../../.env.local'),
  resolve(process.cwd(), 'dividendmapper/.env.local'),
  resolve(process.cwd(), '.env.local'),
];
const envPath = envCandidates.find(p => {
  if (!p) return false;
  try { readFileSync(p); return true; } catch { return false; }
});
if (!envPath) throw new Error('Could not find dividendmapper/.env.local');
loadEnv(envPath);

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com';
const POSTHOG_KEY  = process.env.PERSONAL_POSTHOG_API_KEY;
const PROJECT_ID   = '170790';
const GMAIL_USER   = process.env.GMAIL_USER;
const GMAIL_PASS   = process.env.GMAIL_APP_PASSWORD;

async function hogql(query) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POSTHOG_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) throw new Error(`PostHog query failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getMetrics() {
  const [pvRes, uqRes, pagesRes] = await Promise.all([
    hogql(`SELECT count() FROM events WHERE event = '$pageview' AND toDate(timestamp) = yesterday()`),
    hogql(`SELECT count(distinct person_id) FROM events WHERE event = '$pageview' AND toDate(timestamp) = yesterday()`),
    hogql(`
      SELECT properties.$current_url, count() AS views
      FROM events
      WHERE event = '$pageview' AND toDate(timestamp) = yesterday()
      GROUP BY properties.$current_url
      ORDER BY views DESC
      LIMIT 5
    `),
  ]);

  return {
    pageviews: pvRes.results?.[0]?.[0] ?? 0,
    uniques:   uqRes.results?.[0]?.[0] ?? 0,
    topPages:  pagesRes.results ?? [],
  };
}

function safePath(url) {
  try { return new URL(url).pathname; } catch { return url ?? '/'; }
}

function formatDate(d) {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

async function sendEmail({ pageviews, uniques, topPages }) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = formatDate(yesterday);

  const topPagesText = topPages.length
    ? topPages.map(([url, views], i) => `  ${i + 1}. ${safePath(url)} — ${views} views`).join('\n')
    : '  (no data)';

  const topRowsHtml = topPages.length
    ? topPages.map(([url, views]) =>
        `<tr><td style="padding:3px 24px 3px 0">${safePath(url)}</td><td style="color:#555">${views} views</td></tr>`
      ).join('\n')
    : '<tr><td colspan="2" style="color:#999">No data</td></tr>';

  const subject = `DividendMapper traffic — ${date}`;

  const text = [
    `DividendMapper — Daily Traffic`,
    date, '',
    `Pageviews:       ${pageviews}`,
    `Unique visitors: ${uniques}`, '',
    'Top pages:',
    topPagesText, '',
    `Dashboard: ${POSTHOG_HOST}/project/${PROJECT_ID}/dashboard/656181`,
  ].join('\n');

  const html = `
<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;max-width:500px;color:#111">
  <h2 style="font-size:15px;margin:0 0 2px">DividendMapper — Daily Traffic</h2>
  <p style="margin:0 0 16px;color:#666;font-size:13px">${date}</p>
  <table style="border-collapse:collapse;margin-bottom:20px">
    <tr>
      <td style="padding:4px 32px 4px 0;color:#555">Pageviews</td>
      <td style="font-size:22px;font-weight:700">${pageviews}</td>
    </tr>
    <tr>
      <td style="padding:4px 32px 4px 0;color:#555">Unique visitors</td>
      <td style="font-size:22px;font-weight:700">${uniques}</td>
    </tr>
  </table>
  <p style="margin:0 0 8px;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Top pages</p>
  <table style="border-collapse:collapse;font-size:13px">${topRowsHtml}</table>
  <p style="margin-top:24px;font-size:12px">
    <a href="${POSTHOG_HOST}/project/${PROJECT_ID}/dashboard/656181" style="color:#5C4EFF">Open full dashboard →</a>
  </p>
</div>`;

  const transporter = createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });

  return transporter.sendMail({
    from: `DividendMapper <${GMAIL_USER}>`,
    to: GMAIL_USER,
    subject,
    text,
    html,
  });
}

async function main() {
  console.log('Fetching PostHog metrics for yesterday...');
  const metrics = await getMetrics();
  console.log(`Pageviews: ${metrics.pageviews}, Uniques: ${metrics.uniques}`);

  console.log('Sending via Gmail...');
  const result = await sendEmail(metrics);
  console.log('Done. Message ID:', result.messageId);
}

main().catch(err => { console.error(err.message); process.exit(1); });
