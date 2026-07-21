import { Prisma, ProductImageType, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { MiaoshouProduct } from "@/lib/miaoshou/types";

export async function upsertMiaoshouProduct(product: MiaoshouProduct, userId: string) {
  const existing = await prisma.product.findUnique({
    where: { userId_miaoshouProductId: { userId, miaoshouProductId: product.id } },
    select: { variants: { select: { sku: true, imageUrl: true, rawData: true } } }
  });
  const existingVariants = new Map(existing?.variants.map((variant) => [variant.sku, variant]) ?? []);
  const incomingHasSkuImages = product.variants.some(
    (variant) => Boolean(variant.imageUrl) || imageUrlsFromUnknown(variant.rawData).length > 0
  );
  const variants = product.variants.map((variant) => {
    const previous = existingVariants.get(variant.sku);
    const imageUrl = variant.imageUrl ?? previous?.imageUrl ?? undefined;
    const rawData = {
      ...(previous?.rawData && typeof previous.rawData === "object" && !Array.isArray(previous.rawData) ? previous.rawData : {}),
      ...(variant.rawData as Record<string, unknown>)
    };
    return {
    sku: variant.sku,
    name: variant.name,
    color: variant.color,
    size: variant.size,
      imageUrl,
      rawData: rawData as Prisma.InputJsonValue
    };
  });
  const images = buildImages({ ...product, variants: product.variants.map((variant, index) => ({
    ...variant,
    imageUrl: variants[index]?.imageUrl,
    rawData: variants[index]?.rawData as Record<string, unknown>
  })) });

  return prisma.product.upsert({
    where: { userId_miaoshouProductId: { userId, miaoshouProductId: product.id } },
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
              deleteMany: incomingHasSkuImages ? {} : { type: { not: ProductImageType.SKU_IMAGE } },
              create: incomingHasSkuImages ? images : images.filter((image) => image.type !== ProductImageType.SKU_IMAGE)
            }
          }
        : {})
    },
    create: {
      userId,
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

function buildImages(product: MiaoshouProduct) {
  const seen = new Set<string>();
  const images = product.images
    .filter((image) => image.url)
    .map((image) => {
      seen.add(normalizeUrl(image.url));
      return {
        type: image.type as ProductImageType,
        originalUrl: image.url,
        sortOrder: image.sortOrder
      };
    });

  for (const variant of product.variants) {
    for (const imageUrl of uniqueStrings([variant.imageUrl, ...imageUrlsFromUnknown(variant.rawData)])) {
      const key = normalizeUrl(imageUrl);
      if (seen.has(key)) continue;
      seen.add(key);
      images.push({
        type: ProductImageType.SKU_IMAGE,
        originalUrl: imageUrl,
        sortOrder: images.length
      });
    }
  }

  return images;
}

function normalizeUrl(url: string) {
  return url.trim().replace(/^http:\/\//, "https://").replace(/\?.*$/, "");
}

function imageUrlsFromUnknown(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") return isImageUrl(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => imageUrlsFromUnknown(item, depth + 1));
  if (typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap((child) => imageUrlsFromUnknown(child, depth + 1));
}

function isImageUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("//");
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
