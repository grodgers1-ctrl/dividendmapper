import { createClient } from "@supabase/supabase-js";
import { verifyLifecycleUnsubToken } from "@/lib/email/lifecycle/unsub-token";

// One-click unsubscribe target for lifecycle emails. Validates the HMAC
// token, flips profiles.lifecycle_emails_unsubscribed, renders a plain
// HTML confirmation page. Mirrors lib/alerts/unsub-token + the notifications
// /unsubscribe route, but namespace-isolated.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(message: string): Response {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DividendMapper emails</title><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:64px auto;padding:0 24px;color:#111827"><h1 style="font-size:20px;color:#0d9488">DividendMapper</h1><p style="font-size:16px;line-height:24px">${message}</p><p style="font-size:14px;color:#6b7280">You can re-enable lifecycle emails any time from your account settings.</p></body>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key) return new Response("Server not configured.", { status: 500 });

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return new Response("This unsubscribe link is missing a token.", { status: 400 });

  const userId = verifyLifecycleUnsubToken(token, secret);
  if (!userId) return new Response("This unsubscribe link is invalid or has expired.", { status: 400 });

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await supabase.from("profiles").update({ lifecycle_emails_unsubscribed: true }).eq("id", userId);

  return page("Done. You will no longer receive lifecycle or marketing emails from DividendMapper.");
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
