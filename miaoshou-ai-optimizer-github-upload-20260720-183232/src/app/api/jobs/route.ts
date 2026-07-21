import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createProcessingJob } from "@/lib/jobs/service";
import { requireUser } from "@/lib/auth/session";

export async function GET() {
  const user = await requireUser();
  const jobs = await prisma.processingJob.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { tasks: true } });
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = (await request.json()) as { name?: string; miaoshouProductIds?: string[]; saveMode?: "LOCAL_ONLY" | "PUBLIC_COLLECTION_BOX" | "PLATFORM_COLLECTION_BOX" };
  const job = await createProcessingJob({
    userId: user.id,
    name: body.name ?? `Batch ${new Date().toISOString()}`,
    miaoshouProductIds: body.miaoshouProductIds ?? [],
    saveMode: body.saveMode
  });
  return NextResponse.json(job);
}
