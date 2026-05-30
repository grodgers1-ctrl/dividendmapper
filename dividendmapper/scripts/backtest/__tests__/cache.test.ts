import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { writeCacheAtomic, readCache, cacheExists } from "../cache";

describe("cache helpers", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "backtest-cache-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes JSON atomically and reads it back", () => {
    const path = join(dir, "AAPL", "profile.json");
    writeCacheAtomic(path, { symbol: "AAPL", sector: "Technology" });
    expect(cacheExists(path)).toBe(true);
    expect(readCache(path)).toEqual({ symbol: "AAPL", sector: "Technology" });
  });

  it("does not leave a .tmp file behind on success", () => {
    const path = join(dir, "AAPL", "profile.json");
    writeCacheAtomic(path, { a: 1 });
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it("returns false from cacheExists for missing file", () => {
    expect(cacheExists(join(dir, "missing.json"))).toBe(false);
  });

  it("creates parent directories as needed", () => {
    const path = join(dir, "deep", "nested", "dir", "x.json");
    writeCacheAtomic(path, { ok: true });
    expect(readCache(path)).toEqual({ ok: true });
  });
});
