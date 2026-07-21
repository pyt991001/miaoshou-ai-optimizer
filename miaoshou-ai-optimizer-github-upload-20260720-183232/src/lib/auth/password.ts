import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password: string) {
  if (password.length < 10) throw new Error("密码至少需要 10 位");
  const salt = crypto.randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltText, hashText] = stored.split(":");
  if (algorithm !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64");
  const actual = (await scrypt(password, Buffer.from(saltText, "base64"), expected.length)) as Buffer;
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
