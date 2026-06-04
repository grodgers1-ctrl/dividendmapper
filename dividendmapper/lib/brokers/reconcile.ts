// Pure provenance + supersede reconciliation. Given the existing holdings, the
// incoming broker positions, and the connection being synced, return the writes
// to apply ({ insert, update, archive }) — no I/O, no data loss. The caller maps
// DB rows ↔ these abstract shapes (tickerScoring = the normalised ticker used
// for matching; externalRef = the broker-internal position id, e.g. the T212
// ticker) and applies the result.
//
// Rules:
//   1. Incoming matches an existing synced holding by (connectionId, externalRef)
//      → UPDATE quantity/avgCost.
//   2. Incoming matches a non-archived manual holding by (tickerScoring, wrapper)
//      → ARCHIVE the manual (retained, never deleted) + INSERT the synced one.
//   3. No match → INSERT a new synced holding.
//   4. An existing synced holding for THIS connection not in the incoming set
//      → ARCHIVE it (sold/closed).
//   5. Manual holdings the broker doesn't return → left untouched.
// Already-archived rows are inert: never matched, never re-archived.

export interface ExistingHolding {
  id: string;
  tickerScoring: string;
  wrapper: string;
  source: "manual" | "trading212" | "csv";
  archivedAt: string | null;
  externalRef: string | null;
  connectionId: string | null;
}

export interface IncomingPosition {
  externalRef: string;
  tickerScoring: string;
  wrapper: string;
  quantity: number;
  avgCost: number;
}

export interface InsertHolding {
  tickerScoring: string;
  wrapper: string;
  quantity: number;
  avgCost: number;
  externalRef: string;
  connectionId: string;
  source: "trading212";
}

export interface UpdateHolding {
  id: string;
  quantity: number;
  avgCost: number;
}

export interface ReconcileResult {
  insert: InsertHolding[];
  update: UpdateHolding[];
  archive: string[];
}

function manualKey(tickerScoring: string, wrapper: string): string {
  return `${tickerScoring}::${wrapper}`;
}

function toInsert(pos: IncomingPosition, connectionId: string): InsertHolding {
  return {
    tickerScoring: pos.tickerScoring,
    wrapper: pos.wrapper,
    quantity: pos.quantity,
    avgCost: pos.avgCost,
    externalRef: pos.externalRef,
    connectionId,
    source: "trading212",
  };
}

export function reconcile(
  existing: ExistingHolding[],
  incoming: IncomingPosition[],
  connectionId: string,
): ReconcileResult {
  const insert: InsertHolding[] = [];
  const update: UpdateHolding[] = [];
  const archive: string[] = [];

  const active = existing.filter((h) => h.archivedAt == null);

  // Synced holdings owned by THIS connection, indexed by externalRef.
  const syncedByRef = new Map<string, ExistingHolding>();
  // Manual holdings indexed by (tickerScoring, wrapper) — may be more than one.
  const manualsByKey = new Map<string, ExistingHolding[]>();
  for (const h of active) {
    if (h.source === "trading212" && h.connectionId === connectionId && h.externalRef != null) {
      syncedByRef.set(h.externalRef, h);
    } else if (h.source === "manual") {
      const key = manualKey(h.tickerScoring, h.wrapper);
      const list = manualsByKey.get(key) ?? [];
      list.push(h);
      manualsByKey.set(key, list);
    }
  }

  const seenRefs = new Set<string>();
  for (const pos of incoming) {
    seenRefs.add(pos.externalRef);

    const syncedMatch = syncedByRef.get(pos.externalRef);
    if (syncedMatch) {
      update.push({ id: syncedMatch.id, quantity: pos.quantity, avgCost: pos.avgCost });
      continue;
    }

    const manualMatches = manualsByKey.get(manualKey(pos.tickerScoring, pos.wrapper));
    if (manualMatches && manualMatches.length > 0) {
      for (const m of manualMatches) archive.push(m.id);
    }
    insert.push(toInsert(pos, connectionId));
  }

  // Synced holdings for this connection that disappeared → archive (sold/closed).
  for (const h of active) {
    if (
      h.source === "trading212" &&
      h.connectionId === connectionId &&
      h.externalRef != null &&
      !seenRefs.has(h.externalRef)
    ) {
      archive.push(h.id);
    }
  }

  return { insert, update, archive };
}
