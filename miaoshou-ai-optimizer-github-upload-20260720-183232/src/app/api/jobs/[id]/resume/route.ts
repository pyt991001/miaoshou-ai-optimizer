import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOwnedJob } from "@/lib/auth/ownership";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await requireOwnedJob(id);
  const job = await prisma.processingJob.update({ where: { id }, data: { status: "PENDING", pauseReason: null } });
  return NextResponse.json(job);
}
