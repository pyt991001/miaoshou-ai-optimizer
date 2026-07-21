import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export async function PATCH(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  const user = await requireUser();
  const body = (await request.json()) as { titleOptimizationId?: string; imageOptimizationId?: string; decision: "ACCEPTED" | "REJECTED" | "NEEDS_REVIEW" };
  try {
    const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id }, select: { id: true } });
    if (!product) return NextResponse.json({ message: "商品不存在" }, { status: 404 });
    if (body.titleOptimizationId) {
      await prisma.titleOptimization.updateMany({ where: { id: body.titleOptimizationId, productId }, data: { decision: body.decision } });
    }
    if (body.imageOptimizationId) {
      await prisma.imageOptimization.updateMany({ where: { id: body.imageOptimizationId, image: { productId } }, data: { decision: body.decision, userConfirmed: body.decision === "ACCEPTED" } });
    }
    await prisma.auditLog.create({ data: { userId: user.id, action: "REVIEW_DECISION", entity: "Product", entityId: productId, metadata: body } });
    return NextResponse.json({ ok: true, storage: "database" });
  } catch {
    return NextResponse.json({ ok: true, storage: "local-file", message: "数据库不可用，本地临时商品不记录审核状态" });
  }
}
