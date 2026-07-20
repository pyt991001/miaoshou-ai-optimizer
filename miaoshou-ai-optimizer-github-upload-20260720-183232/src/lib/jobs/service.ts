import crypto from "node:crypto";
import { Prisma, ProcessingStatus, TaskType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createProcessingQueue } from "@/lib/jobs/queue";
import { createMiaoshouClient } from "@/lib/miaoshou/client";
import { upsertMiaoshouProduct } from "@/lib/products/import";
import { optimizeTitle } from "@/lib/openai/title-service";

export async function createProcessingJob(input: {
  name: string;
  miaoshouProductIds: string[];
  saveMode?: "LOCAL_ONLY" | "PUBLIC_COLLECTION_BOX" | "PLATFORM_COLLECTION_BOX";
  settings?: Record<string, unknown>;
}) {
  const job = await prisma.processingJob.create({
    data: {
      name: input.name,
      saveMode: input.saveMode ?? "LOCAL_ONLY",
      totalProducts: input.miaoshouProductIds.length,
      settings: (input.settings ?? {}) as Prisma.InputJsonValue,
      tasks: {
        create: input.miaoshouProductIds.map((productId) => ({
          type: TaskType.FETCH_PRODUCT,
          status: ProcessingStatus.PENDING,
          idempotencyKey: crypto.randomUUID(),
          payload: { miaoshouProductId: productId } as Prisma.InputJsonValue
        }))
      }
    }
  });
  await createProcessingQueue().add("process-products", { processingJobId: job.id, productIds: input.miaoshouProductIds });
  return job;
}

export async function processProduct(miaoshouProductId: string, processingJobId: string) {
  const client = createMiaoshouClient();
  const remote = await client.getProduct(miaoshouProductId);
  const product = await upsertMiaoshouProduct(remote);
  await prisma.product.update({ where: { id: product.id }, data: { processingStatus: ProcessingStatus.OPTIMIZING_TITLE } });
  const titleResult = await optimizeTitle({
    originalTitle: product.originalTitle,
    category: product.category ?? undefined,
    attributes: product.attributes as Record<string, unknown>,
    material: String((product.attributes as Record<string, unknown>).material ?? ""),
    color: String((product.attributes as Record<string, unknown>).color ?? ""),
    targetLanguage: "English",
    targetPlatform: product.targetPlatform,
    maxLength: 120,
    forbiddenWords: ["Best", "No.1", "Guaranteed", "Promo"],
    brandRule: "Do not add brand if not explicit in source data."
  });
  await prisma.titleOptimization.create({
    data: {
      productId: product.id,
      originalTitle: titleResult.originalTitle,
      optimizedTitle: titleResult.optimizedTitle,
      language: titleResult.language,
      characterCount: titleResult.characterCount,
      keywords: titleResult.keywords,
      removedTerms: titleResult.removedTerms,
      warnings: titleResult.warnings,
      confidence: titleResult.confidence,
      prompt: titleResult.prompt,
      model: titleResult.model,
      openaiRequestId: titleResult.requestId,
      inputTokens: titleResult.inputTokens,
      outputTokens: titleResult.outputTokens
    }
  });
  await prisma.product.update({ where: { id: product.id }, data: { optimizedTitle: titleResult.optimizedTitle, processingStatus: ProcessingStatus.WAITING_REVIEW } });
  await prisma.processingTask.create({
    data: {
      jobId: processingJobId,
      productId: product.id,
      type: TaskType.OPTIMIZE_TITLE,
      status: ProcessingStatus.COMPLETED,
      idempotencyKey: crypto.randomUUID(),
      payload: { miaoshouProductId } as Prisma.InputJsonValue
    }
  });
}
