import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Credential encryption for stored broker API secrets (T212 "key:secret" pair).
// AES-256-GCM with a 32-byte key from BROKER_ENCRYPTION_KEY (base64). The blob
// is base64(iv | authTag | ciphertext): a 12-byte random IV, the 16-byte GCM
// auth tag, then the ciphertext. The DB only ever holds this blob; the key lives
// in app env, so the database never sees the key or the plaintext.

const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.BROKER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("BROKER_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("BROKER_ENCRYPTION_KEY must decode to 32 bytes (base64)");
  }
  return key;
}

export function encryptCredential(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptCredential(blob: string): string {
  const key = getKey();
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, IV_BYTES);
  const authTag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
