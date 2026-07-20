import crypto from "node:crypto";
import { Prisma, SaveMode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createMiaoshouClient } from "@/lib/miaoshou/client";
import { findLocalProduct } from "@/lib/products/local-store";

function assertPublicImageUrls(urls: string[]) {
  const invalid = urls.filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname);
    } catch {
      return true;
    }
  });
  if (invalid.length > 0) {
    throw new Error("妙手无法显示本地图片地址。请先配置 OSS/S3/公网图片存储，让洗图结果变成 https 图片 URL 后再保存。");
  }
}

export async function saveProductToMiaoshou(productId: string, saveMode: SaveMode) {
  const product = await prisma.product
    .findUnique({
      where: { id: productId },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
          include: { optimizations: { orderBy: { createdAt: "desc" } } }
        },
        titleOptimizations: true
      }
    })
    .catch(() => null);
  if (!product) throw new Error("Product not found");
  const client = createMiaoshouClient();
  const acceptedTitle = product.titleOptimizations.find((item) => item.decision === "ACCEPTED")?.optimizedTitle ?? product.optimizedTitle ?? product.originalTitle;
  // 洗图操作本身已经由用户选择了具体图片。保存时使用每张图最新的
  // 成功结果，不能只读取审核状态，否则新生成的 PENDING 记录会被漏掉。
  const latestOptimizedUrls = product.images
    .map((image) => image.optimizations.find((item) => Boolean(item.optimizedUrl))?.optimizedUrl)
    .filter((url): url is string => Boolean(url));
  if (latestOptimizedUrls.length === 0) {
    throw new Error("没有找到可保存的洗图结果。请先勾选图片并完成洗图，再保存到妙手公共采集箱。");
  }
  assertPublicImageUrls(latestOptimizedUrls);
  const imageUrls = uniqueUrls(
    product.images.map((image) => image.optimizations.find((item) => Boolean(item.optimizedUrl))?.optimizedUrl ?? image.originalUrl)
  );
  const boxResult =
    saveMode === SaveMode.PLATFORM_COLLECTION_BOX
      ? await client.saveToPlatformCollectionBox(product.miaoshouProductId, process.env.MIAOSHOU_TARGET_BOX ?? process.env.MIAOSHOU_TARGET_PLATFORM ?? "shein", crypto.randomUUID())
      : saveMode === SaveMode.PUBLIC_COLLECTION_BOX
        ? await client.saveToPublicCollectionBox(product.miaoshouProductId, crypto.randomUUID())
        : await client.updateProduct({
            productId: product.miaoshouProductId,
            title: acceptedTitle,
            imageUrls,
            idempotencyKey: crypto.randomUUID()
          });
  return prisma.miaoshouSyncRecord.create({
    data: {
      productId,
      saveMode,
      miaoshouProductId: boxResult.productId,
      miaoshouTaskId: boxResult.taskId,
      requestPayload: { title: acceptedTitle, imageUrls, optimizedImageCount: latestOptimizedUrls.length } as Prisma.InputJsonValue,
      rawResponse: boxResult.rawResponse as Prisma.InputJsonValue,
      status: boxResult.status
    }
  });
}

export async function saveLocalProductToMiaoshou(productId: string, saveMode: SaveMode) {
  const product = await findLocalProduct(productId);
  if (!product) throw new Error("Product not found");
  const client = createMiaoshouClient();
  const optimizedUrls = product.images.map((image) => image.optimizedUrl).filter((url): url is string => Boolean(url));
  if (optimizedUrls.length === 0) {
    throw new Error("没有找到可保存的洗图结果。请先勾选图片并完成洗图，再保存到妙手公共采集箱。");
  }
  assertPublicImageUrls(optimizedUrls);
  const imageUrls = uniqueUrls(product.images.map((image) => image.optimizedUrl ?? image.originalUrl));
  const boxResult =
    saveMode === SaveMode.PLATFORM_COLLECTION_BOX
      ? await client.saveToPlatformCollectionBox(product.miaoshouProductId, process.env.MIAOSHOU_TARGET_BOX ?? process.env.MIAOSHOU_TARGET_PLATFORM ?? "shein", crypto.randomUUID())
      : saveMode === SaveMode.PUBLIC_COLLECTION_BOX
        ? await client.saveToPublicCollectionBox(product.miaoshouProductId, crypto.randomUUID())
        : await client.updateProduct({
            productId: product.miaoshouProductId,
            title: product.optimizedTitle ?? product.originalTitle,
            imageUrls,
            idempotencyKey: crypto.randomUUID()
          });
  return {
    id: `local-sync-${Date.now()}`,
    productId,
    saveMode,
    miaoshouProductId: boxResult.productId,
    miaoshouTaskId: boxResult.taskId,
    status: boxResult.status,
    rawResponse: boxResult.rawResponse
  };
}

function uniqueUrls(urls: string[]) {
  return [...new Set(urls)];
}
