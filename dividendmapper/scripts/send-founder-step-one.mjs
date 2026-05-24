#!/usr/bin/env node
// One-shot send: founder Step 1 email to the 3 unsigned founders. Run after
// `npx email export -d ./emails --outDir ./emails-rendered`.
//
// Usage (from dividendmapper/):
//   set -a && source .env.local && set +a
//   npx email export -d ./emails --outDir ./emails-rendered
//   node scripts/send-founder-step-one.mjs

import { Resend } from "resend";
import fs from "node:fs";

const RECIPIENTS = [
  "david.hoare792@btinternet.com",
  "mail@rolandhead.com",
  "hannahsophiamoulai@gmail.com",
];

const HTML_PATH = "emails-rendered/founder-step-one.html";
const FROM = "DividendMapper <hello@dividendmapper.com>";
const SUBJECT = "You're in. Sign in to activate your Pro access.";

if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY not set");
  process.exit(1);
}
if (!fs.existsSync(HTML_PATH)) {
  console.error(`HTML not found at ${HTML_PATH}`);
  console.error("Run: npx email export -d ./emails --outDir ./emails-rendered");
  process.exit(1);
}

const html = fs.readFileSync(HTML_PATH, "utf8");
const resend = new Resend(process.env.RESEND_API_KEY);

for (const to of RECIPIENTS) {
  try {
    const r = await resend.emails.send({
      from: FROM,
      to,
      subject: SUBJECT,
      html,
    });
    if (r.error) {
      console.error(`FAIL  ${to}: ${r.error.message}`);
    } else {
      console.log(`OK    ${to}  id=${r.data?.id ?? "(no id)"}`);
    }
  } catch (e) {
    console.error(`FAIL  ${to}: ${e.message}`);
  }
}
