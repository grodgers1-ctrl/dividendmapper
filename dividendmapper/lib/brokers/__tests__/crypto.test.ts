import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptCredential, decryptCredential } from "@/lib/brokers/crypto";

// A valid 32-byte key, base64-encoded, as it would live in BROKER_ENCRYPTION_KEY.
const VALID_KEY = randomBytes(32).toString("base64");

describe("brokers/crypto", () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.BROKER_ENCRYPTION_KEY;
    process.env.BROKER_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.BROKER_ENCRYPTION_KEY;
    else process.env.BROKER_ENCRYPTION_KEY = savedKey;
  });

  it("round-trips a credential string", () => {
    const plaintext = "37charKeyId:43charSecretValueGoesHerePadded";
    const blob = encryptCredential(plaintext);
    expect(blob).not.toContain(plaintext);
    expect(decryptCredential(blob)).toBe(plaintext);
  });

  it("produces different ciphertext each call for the same plaintext (random IV)", () => {
    const plaintext = "same-secret";
    const a = encryptCredential(plaintext);
    const b = encryptCredential(plaintext);
    expect(a).not.toBe(b);
    // ...but both still decrypt back to the same plaintext.
    expect(decryptCredential(a)).toBe(plaintext);
    expect(decryptCredential(b)).toBe(plaintext);
  });

  it("rejects a tampered blob (GCM auth tag mismatch)", () => {
    const blob = encryptCredential("trust-critical");
    const raw = Buffer.from(blob, "base64");
    // Flip a bit in the final ciphertext byte (past the 12-byte IV + 16-byte tag).
    raw[raw.length - 1] ^= 0x01;
    const tampered = raw.toString("base64");
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it("throws on encrypt when BROKER_ENCRYPTION_KEY is missing", () => {
    delete process.env.BROKER_ENCRYPTION_KEY;
    expect(() => encryptCredential("x")).toThrow(/BROKER_ENCRYPTION_KEY/);
  });

  it("throws on decrypt when BROKER_ENCRYPTION_KEY is missing", () => {
    const blob = encryptCredential("x");
    delete process.env.BROKER_ENCRYPTION_KEY;
    expect(() => decryptCredential(blob)).toThrow(/BROKER_ENCRYPTION_KEY/);
  });

  it("throws when the key does not decode to 32 bytes", () => {
    process.env.BROKER_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encryptCredential("x")).toThrow(/32 bytes/);
  });
});
