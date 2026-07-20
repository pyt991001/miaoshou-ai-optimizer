import crypto from "node:crypto";
import { getEnv } from "@/lib/config/env";

function key(): Buffer {
  const configured = getEnv().APP_ENCRYPTION_KEY;
  const maybeBase64 = Buffer.from(configured, "base64");
  if (maybeBase64.length === 32) return maybeBase64;
  return crypto.createHash("sha256").update(configured).digest();
}

export function encryptSecret(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret<T>(payload: string): T {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function last4(value?: string): string | undefined {
  return value ? value.slice(-4) : undefined;
}
