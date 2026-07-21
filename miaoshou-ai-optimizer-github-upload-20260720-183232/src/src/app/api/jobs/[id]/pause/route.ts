import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await prisma.processingJob.update({ where: { id }, data: { status: "PENDING", pauseReason: "Paused by user" } });
  return NextResponse.json(job);
}
