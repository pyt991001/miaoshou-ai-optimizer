import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const [errors, audits] = await Promise.all([
    prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  return NextResponse.json({ errors, audits });
}
