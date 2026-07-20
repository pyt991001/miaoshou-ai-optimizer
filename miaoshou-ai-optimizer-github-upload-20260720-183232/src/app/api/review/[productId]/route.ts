import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  const body = (await request.json()) as { titleOptimizationId?: string; imageOptimizationId?: string; decision: "ACCEPTED" | "REJECTED" | "NEEDS_REVIEW" };
  try {
    if (body.titleOptimizationId) {
      await prisma.titleOptimization.update({ where: { id: body.titleOptimizationId }, data: { decision: body.decision } });
    }
    if (body.imageOptimizationId) {
      await prisma.imageOptimization.update({ where: { id: body.imageOptimizationId }, data: { decision: body.decision, userConfirmed: body.decision === "ACCEPTED" } });
    }
    await prisma.auditLog.create({ data: { action: "REVIEW_DECISION", entity: "Product", entityId: productId, metadata: body } });
    return NextResponse.json({ ok: true, storage: "database" });
  } catch {
    return NextResponse.json({ ok: true, storage: "local-file", message: "数据库不可用，本地临时商品不记录审核状态" });
  }
}
