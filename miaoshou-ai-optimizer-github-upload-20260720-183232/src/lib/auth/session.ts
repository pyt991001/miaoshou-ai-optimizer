import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";

export const SESSION_COOKIE = "miaoshou_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = { userId: string; version: number; expiresAt: number };

function sign(value: string) {
  return crypto.createHmac("sha256", getEnv().APP_SESSION_SECRET).update(value).digest("base64url");
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(value?: string): SessionPayload | null {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    return payload.expiresAt > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export async function createSession(user: { id: string; sessionVersion: number }) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encode({ userId: user.id, version: user.sessionVersion, expiresAt: Date.now() + SESSION_SECONDS * 1000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function getCurrentUser() {
  const jar = await cookies();
  const payload = decode(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  return prisma.user.findFirst({
    where: { id: payload.userId, sessionVersion: payload.version, active: true },
    select: { id: true, email: true, name: true, role: true, active: true, sessionVersion: true }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export function requireSecondConfirmation(value: unknown) {
  if (value !== true) throw new Error("Second confirmation is required before publishing products");
}
