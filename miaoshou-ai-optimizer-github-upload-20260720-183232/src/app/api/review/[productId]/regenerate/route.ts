import { NextRequest, NextResponse } from "next/server";
import { Prisma, ProcessingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { prepareImageForOpenAI } from "@/lib/openai/image-download";
import { optimizeProductImage } from "@/lib/openai/image-service";
import { optimizeTitle } from "@/lib/openai/title-service";
import { findLocalProduct, updateLocalProductOptimizedImages, updateLocalProductStatus, updateLocalProductTitle } from "@/lib/products/local-store";
import { requireUser } from "@/lib/auth/session";
import { runWithAccountConfig } from "@/lib/config/account-runtime";

const imageTimeoutMs = 480_000;

export async function POST(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  const user = await requireUser();
  return runWithAccountConfig(user.id, () => regenerate(request, context, user.id));
}

async function regenerate(request: NextRequest, context: { params: Promise<{ productId: string }> }, userId: string) {
  let currentProductId: string | null = null;
  let isLocalProduct = false;
  try {
    const { productId } = await context.params;
    currentProductId = productId;
    const body = (await request.json().catch(() => ({}))) as { type?: "title" | "image"; imageIds?: string[]; ruleProfileId?: string };

    const dbProduct = await prisma.product
      .findFirst({
        where: { id: productId, userId },
        include: {
          images: true,
          titleOptimizations: { orderBy: { createdAt: "desc" } }
        }
      })
      .catch(() => null);
    const localProduct = dbProduct ? null : await findLocalProduct(productId);
    isLocalProduct = !dbProduct && Boolean(localProduct);
    const product = dbProduct ?? localProduct;
    if (!product) {
      return NextResponse.json({ error: "PRODUCT_NOT_FOUND", message: "商品不存在" }, { status: 404 });
    }

    if (body.type === "image") {
      if (isLocalProduct) await updateLocalProductStatus(productId, "PROCESSING_IMAGES");
      if (!getEnv().OPENAI_API_KEY) {
        if (isLocalProduct) await updateLocalProductStatus(productId, "FAILED", "真正洗图需要先在 .env 配置 OPENAI_API_KEY，然后重启网站。");
        return NextResponse.json(
          {
            error: "OPENAI_API_KEY_REQUIRED",
            message: "真正洗图需要先在 .env 配置 OPENAI_API_KEY，然后重启网站。"
          },
          { status: 400 }
        );
      }
      if (dbProduct) {
        const records = [];
        const imagesToProcess = selectImagesForRegeneration(dbProduct.images, body.imageIds);
        for (const image of imagesToProcess) {
          const originalPath = await prepareImageForOpenAI({ imageUrl: image.originalUrl, productId: dbProduct.id, imageId: image.id });
          const result = await withTimeout(
            optimizeProductImage({
              originalPath,
              title: dbProduct.optimizedTitle ?? dbProduct.originalTitle,
              category: dbProduct.category ?? undefined,
              imageType: image.type,
              ruleProfileId: body.ruleProfileId
            }),
            imageTimeoutMs,
            "洗图超过 8 分钟仍未完成，已自动停止。请稍后重试，或检查图片 AI 模型/中转站通道。"
          );
          if (!result.optimizedUrl) throw new Error("图片 AI 返回成功，但没有生成优化图片地址。");
          records.push(
            await prisma.imageOptimization.create({
              data: {
                productImageId: image.id,
                originalUrl: image.originalUrl,
                optimizedUrl: result.optimizedUrl,
                optimizedLocalPath: result.optimizedPath,
                openaiRequestId: result.requestId,
                model: result.model,
                prompt: result.prompt,
                imageType: image.type,
                processingMs: result.processingMs,
                apiCostUsd: result.costUsd,
                consistencyScore: result.validation.score,
                validationReport: result.validation as unknown as Prisma.InputJsonValue
              }
            })
          );
        }
        return NextResponse.json({
          ok: true,
          type: "image",
          storage: "database",
          regenerated: records.length,
          optimizedUrls: records.map((record) => record.optimizedUrl).filter(Boolean),
          message: "图片已通过 OpenAI 洗图生成"
        });
      }
      const optimizedByImageId: Record<string, string> = {};
      const imagesToProcess = selectImagesForRegeneration(localProduct?.images ?? [], body.imageIds);
      for (const image of imagesToProcess) {
        const originalPath = await prepareImageForOpenAI({ imageUrl: image.originalUrl, productId: product.id, imageId: image.id });
        const result = await withTimeout(
          optimizeProductImage({
            originalPath,
            title: product.optimizedTitle ?? product.originalTitle,
            category: product.category ?? undefined,
            imageType: image.type,
            ruleProfileId: body.ruleProfileId
          }),
          imageTimeoutMs,
          "洗图超过 8 分钟仍未完成，已自动停止。请稍后重试，或检查图片 AI 模型/中转站通道。"
        );
        if (!result.optimizedUrl) throw new Error("图片 AI 返回成功，但没有生成优化图片地址。");
        optimizedByImageId[image.id] = result.optimizedUrl;
      }
      if (Object.keys(optimizedByImageId).length === 0) throw new Error("没有可洗的商品图片。");
      const updated = await updateLocalProductOptimizedImages(productId, optimizedByImageId);
      const verified = await findLocalProduct(productId);
      const regenerated = Object.keys(optimizedByImageId).length;
      const verifiedCount = verified?.images.filter((image) => optimizedByImageId[image.id] && image.optimizedUrl).length ?? 0;
      console.log("[image-regenerate] local image result saved", {
        productId,
        optimizedByImageId,
        regenerated,
        verifiedCount
      });
      if (regenerated === 0 || verifiedCount === 0) throw new Error("洗图完成但没有写入优化图片，请重试。");
      return NextResponse.json({
        ok: true,
        type: "image",
        storage: "local-file",
        regenerated,
        optimizedUrls: verified?.images.filter((image) => optimizedByImageId[image.id]).map((image) => image.optimizedUrl).filter(Boolean) ?? [],
        message: "图片已通过 OpenAI 洗图生成"
      });
    }

    if (isLocalProduct) await updateLocalProductStatus(productId, "OPTIMIZING_TITLE");
    const attributes = product.attributes as Record<string, unknown>;
    const result = await optimizeTitle({
      originalTitle: product.originalTitle,
      category: product.category ?? undefined,
      attributes,
      material: String(attributes.material ?? ""),
      color: String(attributes.color ?? ""),
      size: String(attributes.size ?? ""),
      targetLanguage: "English",
      targetPlatform: product.targetPlatform,
      maxLength: 120,
      forbiddenWords: ["Best", "No.1", "Guaranteed", "Promo"],
      brandRule: "Do not add brand if not explicit in source data."
    });

    if (dbProduct) {
      const record = await prisma.titleOptimization.create({
        data: {
          productId: dbProduct.id,
          originalTitle: result.originalTitle,
          optimizedTitle: result.optimizedTitle,
          language: result.language,
          characterCount: result.characterCount,
          keywords: result.keywords,
          removedTerms: result.removedTerms,
          warnings: result.warnings,
          confidence: result.confidence,
          prompt: result.prompt,
          model: result.model,
          openaiRequestId: result.requestId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens
        }
      });
      await prisma.product.update({
        where: { id: dbProduct.id },
        data: {
          optimizedTitle: result.optimizedTitle,
          processingStatus: ProcessingStatus.WAITING_REVIEW
        }
      });
      return NextResponse.json({ ok: true, type: "title", storage: "database", optimizedTitle: result.optimizedTitle, titleOptimizationId: record.id });
    }

    await updateLocalProductTitle(productId, result.optimizedTitle);
    return NextResponse.json({ ok: true, type: "title", storage: "local-file", optimizedTitle: result.optimizedTitle });
  } catch (error) {
    if (currentProductId && isLocalProduct) {
      const latest = await findLocalProduct(currentProductId).catch(() => null);
      const hasReturnedImage = latest?.images.some((image) => Boolean(image.optimizedUrl)) ?? false;
      if (hasReturnedImage) {
        await updateLocalProductStatus(currentProductId, "WAITING_REVIEW", null).catch(() => null);
        return NextResponse.json({
          ok: true,
          type: "image",
          storage: "local-file",
          regenerated: latest?.images.filter((image) => image.optimizedUrl).length ?? 0,
          message: "图片已生成，已恢复为待人工审核"
        });
      }
      await updateLocalProductStatus(currentProductId, "FAILED", error instanceof Error ? error.message : "重新生成失败").catch(() => null);
    }
    return NextResponse.json(
      {
        error: "REGENERATE_FAILED",
        message: error instanceof Error ? error.message : "重新生成失败"
      },
      { status: 500 }
    );
  }
}

function selectImagesForRegeneration<T extends { id: string }>(images: T[], imageIds?: string[]): T[] {
  const validIds = new Set(images.map((image) => image.id));
  const requestedIds = (imageIds ?? []).filter((id) => validIds.has(id));
  if (requestedIds.length > 0) {
    const requested = new Set(requestedIds);
    return images.filter((image) => requested.has(image.id));
  }
  return images.slice(0, 1);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
