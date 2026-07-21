import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await prisma.processingJob.findUnique({ where: { id }, include: { tasks: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}
