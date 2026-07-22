import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ProcessingStatus, SaveMode, TaskType } from "@prisma/client";
import { saveLocalProductToMiaoshou, saveProductToMiaoshou } from "@/lib/miaoshou/sync";
import { updateLocalProductStatus } from "@/lib/products/local-store";
import { requireUser } from "@/lib/auth/session";
import { runWithAccountConfig } from "@/lib/config/account-runtime";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  return runWithAccountConfig(user.id, () => sync(request, user.id));
}

async function sync(request: NextRequest, userId: string) {
  let body: { productId: string; saveMode?: SaveMode } | null = null;
  let trackingJobId: string | null = null;
  let trackingTaskId: string | null = null;
  try {
    body = (await request.json()) as { productId: string; saveMode?: SaveMode };
    const isLocal = body.productId.startsWith("local-");
    const dbProduct = isLocal ? null : await prisma.product.findFirst({
      where: { id: body.productId, userId },
      select: { id: true, miaoshouProductId: true }
    });
    const label = dbProduct?.miaoshouProductId ?? body.productId;
    const tracking = await prisma.processingJob.create({
      data: {
        userId,
        name: `保存到妙手 · ${label}`,
        status: ProcessingStatus.SAVING_TO_MIAOSHOU,
        saveMode: body.saveMode ?? SaveMode.LOCAL_ONLY,
        totalProducts: 1,
        settings: { operation: "miaoshou-sync", productId: body.productId, miaoshouProductId: label },
        tasks: {
          create: {
            productId: dbProduct?.id,
            type: TaskType.SAVE_TO_MIAOSHOU,
            status: ProcessingStatus.SAVING_TO_MIAOSHOU,
            attempts: 1,
            maxAttempts: 1,
            startedAt: new Date(),
            idempotencyKey: crypto.randomUUID(),
            payload: { productId: body.productId, miaoshouProductId: label, saveMode: body.saveMode ?? SaveMode.LOCAL_ONLY }
          }
        }
      },
      include: { tasks: true }
    });
    trackingJobId = tracking.id;
    trackingTaskId = tracking.tasks[0]?.id ?? null;
    if (isLocal) await updateLocalProductStatus(body.productId, "SAVING_TO_MIAOSHOU");
    else if (dbProduct) await prisma.product.update({ where: { id: dbProduct.id }, data: { processingStatus: ProcessingStatus.SAVING_TO_MIAOSHOU } });
    const record = body.productId.startsWith("local-")
      ? await saveLocalProductToMiaoshou(body.productId, body.saveMode ?? SaveMode.LOCAL_ONLY)
      : await saveProductToMiaoshou(body.productId, body.saveMode ?? SaveMode.LOCAL_ONLY, userId);
    if (isLocal) await updateLocalProductStatus(body.productId, "COMPLETED");
    else if (dbProduct) await prisma.product.update({ where: { id: dbProduct.id }, data: { processingStatus: ProcessingStatus.COMPLETED } });
    await prisma.$transaction([
      prisma.processingJob.update({ where: { id: tracking.id }, data: { status: ProcessingStatus.COMPLETED, completedCount: 1 } }),
      prisma.processingTask.update({ where: { id: tracking.tasks[0].id }, data: { status: ProcessingStatus.COMPLETED, completedAt: new Date(), errorMessage: null } })
    ]);
    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存到妙手失败";
    if (trackingJobId && trackingTaskId) {
      await prisma.$transaction([
        prisma.processingJob.update({ where: { id: trackingJobId }, data: { status: ProcessingStatus.FAILED, failedCount: 1 } }),
        prisma.processingTask.update({ where: { id: trackingTaskId }, data: { status: ProcessingStatus.FAILED, completedAt: new Date(), errorMessage: message } })
      ]).catch(() => null);
    }
    if (body && !body.productId.startsWith("local-")) {
      await prisma.product.updateMany({ where: { id: body.productId, userId }, data: { processingStatus: ProcessingStatus.FAILED } }).catch(() => null);
    }
    if (body?.productId.startsWith("local-")) {
      await updateLocalProductStatus(body.productId, "FAILED", message).catch(() => null);
    }
    return NextResponse.json(
      {
        error: "MIAOSHOU_SYNC_FAILED",
        message
      },
      { status: 500 }
    );
  }
}
