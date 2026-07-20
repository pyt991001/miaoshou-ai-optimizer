import { Prisma, ProductImageType, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { MiaoshouProduct } from "@/lib/miaoshou/types";

export async function upsertMiaoshouProduct(product: MiaoshouProduct) {
  const variants = product.variants.map((variant) => ({
    sku: variant.sku,
    name: variant.name,
    color: variant.color,
    size: variant.size,
    imageUrl: variant.imageUrl,
    rawData: variant.rawData as Prisma.InputJsonValue
  }));
  const images = product.images.map((image) => ({
    type: image.type as ProductImageType,
    originalUrl: image.url,
    sortOrder: image.sortOrder
  }));

  return prisma.product.upsert({
    where: { miaoshouProductId: product.id },
    update: {
      originalTitle: product.title,
      status: product.status as ProductStatus,
      source: product.source,
      targetPlatform: product.targetPlatform,
      category: product.category,
      attributes: product.attributes as Prisma.InputJsonValue,
      description: product.description,
      ...(variants.length > 0
        ? {
            variants: {
              deleteMany: {},
              create: variants
            }
          }
        : {}),
      ...(images.length > 0
        ? {
            images: {
              deleteMany: {},
              create: images
            }
          }
        : {})
    },
    create: {
      miaoshouProductId: product.id,
      originalTitle: product.title,
      status: product.status as ProductStatus,
      source: product.source,
      targetPlatform: product.targetPlatform,
      category: product.category,
      attributes: product.attributes as Prisma.InputJsonValue,
      description: product.description,
      variants: {
        create: variants
      },
      images: {
        create: images
      }
    },
    include: {
      variants: true,
      images: true
    }
  });
}
