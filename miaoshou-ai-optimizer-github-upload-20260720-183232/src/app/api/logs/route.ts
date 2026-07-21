import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export async function GET() {
  const user = await requireUser();
  const [errors, audits] = await Promise.all([
    prisma.errorLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.auditLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  return NextResponse.json({ errors, audits });
}
