// Standalone backup for nightly inspect_lookup_audit pruning.
// The /api/internal/refresh-equity-scores cron also runs this prune as a final
// step; this script lets a human run the same prune manually if the route fails.
//
// Usage:
//   set -a && source .env.local && set +a
//   node dividendmapper/scripts/cron/prune-inspect-audit.mjs

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const { error, count } = await sb
  .from('inspect_lookup_audit')
  .delete({ count: 'exact' })
  .lt('occurred_at', cutoff);
if (error) {
  console.error('prune failed', error);
  process.exit(1);
}
console.log(`Pruned ${count ?? 0} inspect_lookup_audit rows older than ${cutoff}`);
