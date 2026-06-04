import { describe, it, expect } from "vitest";
import { reconcile, type ExistingHolding, type IncomingPosition } from "@/lib/brokers/reconcile";

const CONN = "conn-1";

function existing(p: Partial<ExistingHolding> & Pick<ExistingHolding, "id">): ExistingHolding {
  return {
    id: p.id,
    tickerScoring: p.tickerScoring ?? "AAA",
    wrapper: p.wrapper ?? "isa",
    source: p.source ?? "manual",
    archivedAt: p.archivedAt ?? null,
    externalRef: p.externalRef ?? null,
    connectionId: p.connectionId ?? null,
  };
}

function incoming(p: Partial<IncomingPosition> & Pick<IncomingPosition, "externalRef">): IncomingPosition {
  return {
    externalRef: p.externalRef,
    tickerScoring: p.tickerScoring ?? "AAA",
    wrapper: p.wrapper ?? "isa",
    quantity: p.quantity ?? 1,
    avgCost: p.avgCost ?? 10,
  };
}

describe("reconcile (provenance + supersede)", () => {
  it("inserts a brand-new synced holding when nothing matches", () => {
    const r = reconcile([], [incoming({ externalRef: "FOURl_EQ", tickerScoring: "FOUR" })], CONN);
    expect(r.update).toEqual([]);
    expect(r.archive).toEqual([]);
    expect(r.insert).toHaveLength(1);
    expect(r.insert[0]).toMatchObject({
      tickerScoring: "FOUR",
      wrapper: "isa",
      externalRef: "FOURl_EQ",
      connectionId: CONN,
      source: "trading212",
    });
  });

  it("updates an existing synced holding matched by (connection, externalRef)", () => {
    const ex = existing({ id: "h1", source: "trading212", connectionId: CONN, externalRef: "VODl_EQ", tickerScoring: "VOD.L" });
    const r = reconcile([ex], [incoming({ externalRef: "VODl_EQ", tickerScoring: "VOD.L", quantity: 99, avgCost: 1.23 })], CONN);
    expect(r.insert).toEqual([]);
    expect(r.archive).toEqual([]);
    expect(r.update).toEqual([{ id: "h1", quantity: 99, avgCost: 1.23 }]);
  });

  it("supersedes a manual holding: archives the manual and inserts the synced one", () => {
    const manual = existing({ id: "m1", source: "manual", tickerScoring: "LGEN.L", wrapper: "isa" });
    const r = reconcile([manual], [incoming({ externalRef: "LGENl_EQ", tickerScoring: "LGEN.L", wrapper: "isa" })], CONN);
    expect(r.archive).toEqual(["m1"]);
    expect(r.insert).toHaveLength(1);
    expect(r.insert[0]).toMatchObject({ tickerScoring: "LGEN.L", externalRef: "LGENl_EQ", source: "trading212" });
    expect(r.update).toEqual([]);
  });

  it("archives a synced holding (this connection) that is no longer in the incoming set (sold)", () => {
    const sold = existing({ id: "s1", source: "trading212", connectionId: CONN, externalRef: "OLDl_EQ", tickerScoring: "OLD.L" });
    const r = reconcile([sold], [], CONN);
    expect(r.archive).toEqual(["s1"]);
    expect(r.insert).toEqual([]);
    expect(r.update).toEqual([]);
  });

  it("leaves a manual holding untouched when the broker does not return it", () => {
    const manual = existing({ id: "m1", source: "manual", tickerScoring: "SMT.L", wrapper: "isa" });
    const r = reconcile([manual], [], CONN);
    expect(r.archive).toEqual([]);
    expect(r.insert).toEqual([]);
    expect(r.update).toEqual([]);
  });

  it("does not supersede a manual in a different wrapper (different key)", () => {
    const manualSipp = existing({ id: "m1", source: "manual", tickerScoring: "LGEN.L", wrapper: "sipp" });
    const r = reconcile([manualSipp], [incoming({ externalRef: "LGENl_EQ", tickerScoring: "LGEN.L", wrapper: "isa" })], CONN);
    expect(r.archive).toEqual([]); // SIPP manual stays
    expect(r.insert).toHaveLength(1);
    expect(r.insert[0]).toMatchObject({ wrapper: "isa" });
  });

  it("handles a user with both a manual and a synced holding correctly", () => {
    const manual = existing({ id: "m1", source: "manual", tickerScoring: "ULVR.L", wrapper: "isa" });
    const synced = existing({ id: "s1", source: "trading212", connectionId: CONN, externalRef: "VODl_EQ", tickerScoring: "VOD.L", wrapper: "isa" });
    const r = reconcile(
      [manual, synced],
      [
        incoming({ externalRef: "VODl_EQ", tickerScoring: "VOD.L", wrapper: "isa", quantity: 5 }), // updates synced
        incoming({ externalRef: "ULVRl_EQ", tickerScoring: "ULVR.L", wrapper: "isa" }), // supersedes manual
      ],
      CONN,
    );
    expect(r.update).toEqual([{ id: "s1", quantity: 5, avgCost: 10 }]);
    expect(r.archive).toEqual(["m1"]);
    expect(r.insert).toHaveLength(1);
    expect(r.insert[0]).toMatchObject({ tickerScoring: "ULVR.L", externalRef: "ULVRl_EQ" });
  });

  it("is idempotent on re-sync: a second pass yields only updates, no inserts or archives", () => {
    // State after a first sync: the synced holding already exists.
    const synced = existing({ id: "s1", source: "trading212", connectionId: CONN, externalRef: "VODl_EQ", tickerScoring: "VOD.L" });
    const r = reconcile([synced], [incoming({ externalRef: "VODl_EQ", tickerScoring: "VOD.L", quantity: 1, avgCost: 10 })], CONN);
    expect(r.insert).toEqual([]);
    expect(r.archive).toEqual([]);
    expect(r.update).toEqual([{ id: "s1", quantity: 1, avgCost: 10 }]);
  });

  it("ignores already-archived rows (no re-archive, no match)", () => {
    const archivedManual = existing({ id: "m1", source: "manual", tickerScoring: "LGEN.L", wrapper: "isa", archivedAt: "2026-01-01T00:00:00Z" });
    const r = reconcile([archivedManual], [incoming({ externalRef: "LGENl_EQ", tickerScoring: "LGEN.L", wrapper: "isa" })], CONN);
    expect(r.archive).toEqual([]); // already archived; not touched
    expect(r.insert).toHaveLength(1); // treated as new (no active manual to supersede)
  });

  it("does not archive a synced holding belonging to a different connection", () => {
    const otherConn = existing({ id: "o1", source: "trading212", connectionId: "conn-2", externalRef: "VODl_EQ", tickerScoring: "VOD.L" });
    const r = reconcile([otherConn], [], CONN);
    expect(r.archive).toEqual([]); // conn-2's holding is not ours to archive
  });

  it("archives all manuals when more than one matches the same key", () => {
    const m1 = existing({ id: "m1", source: "manual", tickerScoring: "LGEN.L", wrapper: "isa" });
    const m2 = existing({ id: "m2", source: "manual", tickerScoring: "LGEN.L", wrapper: "isa" });
    const r = reconcile([m1, m2], [incoming({ externalRef: "LGENl_EQ", tickerScoring: "LGEN.L", wrapper: "isa" })], CONN);
    expect(r.archive.sort()).toEqual(["m1", "m2"]);
    expect(r.insert).toHaveLength(1);
  });
});
