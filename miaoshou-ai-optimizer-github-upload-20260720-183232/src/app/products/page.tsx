import { ImportProductsButton } from "@/components/import-products-button";
import { ProductsTable } from "@/components/products-table";
import { prisma } from "@/lib/db/prisma";
import { safeQuery } from "@/lib/db/safe-query";
import type { LocalProduct } from "@/lib/products/local-store";
import { requirePageUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const user = await requirePageUser();
  const dbProducts = await safeQuery(
    () =>
      prisma.product.findMany({
        where: { userId: user.id },
        include: {
          variants: true,
          images: {
            include: { optimizations: { orderBy: { createdAt: "desc" }, take: 1 } },
            orderBy: { sortOrder: "asc" }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 500
      }),
    [],
    "products-page-list"
  );
  const localProducts: LocalProduct[] = [];
  const rows =
    dbProducts.length > 0
      ? dbProducts.map((product) => ({
          id: product.id,
          miaoshouProductId: product.miaoshouProductId,
          mainImageUrl: product.images[0]?.originalUrl ?? null,
          optimizedMainImageUrl: getOptimizedImageUrl(product.images[0]),
          originalTitle: product.originalTitle,
          optimizedTitle: product.optimizedTitle ?? null,
          status: product.status,
          source: product.source,
          targetPlatform: product.targetPlatform,
          imageCount: product.images.length,
          skuCount: product.variants.length,
          skuList: product.variants.map((variant, variantIndex) => ({
            sku: variant.sku,
            name: variant.name,
            color: variant.color,
            size: variant.size,
            imageUrl: variant.imageUrl,
            ...getSkuPreview(variant, product.images, variantIndex)
          })),
          processingStatus: product.processingStatus,
          updatedAt: product.updatedAt.toLocaleString()
        }))
      : localProducts.map((product) => ({
    id: product.id,
    miaoshouProductId: product.miaoshouProductId,
    mainImageUrl: product.images[0]?.originalUrl ?? null,
    optimizedMainImageUrl: getOptimizedImageUrl(product.images[0]),
    originalTitle: product.originalTitle,
    optimizedTitle: product.optimizedTitle ?? null,
    status: product.status,
    source: product.source,
    targetPlatform: product.targetPlatform,
    imageCount: product.images.length,
    skuCount: product.variants.length,
    skuList: product.variants.map((variant, variantIndex) => ({
      sku: variant.sku,
      name: variant.name,
      color: variant.color,
      size: variant.size,
      imageUrl: variant.imageUrl,
      ...getSkuPreview(variant, product.images, variantIndex)
    })),
    processingStatus: product.processingStatus,
    updatedAt: product.updatedAt.toLocaleString()
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">商品列表</h1>
          <p className="text-sm text-slate-600">从妙手公共采集箱导入商品，审核后保存回公共采集箱。</p>
        </div>
        <ImportProductsButton />
      </div>
      <div className="panel overflow-hidden">
        {rows.length === 0 ? (
          <div className="border-b border-line bg-amber-50 p-4 text-sm text-amber-800">
            还没有商品数据。点击右上角“导入妙手公共采集箱商品”；如果导入失败，请检查妙手 AppKey/AppSecret 或 Docker 数据库是否已启动。
          </div>
        ) : null}
        <ProductsTable products={rows} />
      </div>
    </div>
  );
}

function getOptimizedImageUrl(
  image:
    | {
        optimizedUrl?: string | null;
        optimizations?: Array<{ optimizedUrl: string | null }>;
      }
    | undefined
) {
  if (!image) return null;
  if ("optimizations" in image) return image.optimizations?.[0]?.optimizedUrl ?? null;
  return image.optimizedUrl ?? null;
}

function getSkuPreview(
  variant: { imageUrl?: string | null; rawData: unknown },
  images: Array<{
    id: string;
    originalUrl: string;
    type?: string;
    optimizedUrl?: string | null;
    optimizations?: Array<{ optimizedUrl: string | null }>;
  }>,
  variantIndex: number
) {
  const skuUrls = uniqueStrings([variant.imageUrl, ...imageUrlsFromUnknown(variant.rawData)]);
  const skuUrlKeys = new Set(skuUrls.map(normalizeUrl));
  const explicitlyMatchedImages = images.filter((image) => skuUrlKeys.has(normalizeUrl(image.originalUrl)));
  const fallbackImage = images[variantIndex % Math.max(images.length, 1)];
  const matchedImages = explicitlyMatchedImages.length > 0 ? explicitlyMatchedImages : fallbackImage ? [fallbackImage] : [];
  const optimizedUrls = uniqueStrings(
    matchedImages.map((image) => getOptimizedImageUrl(image))
  );
  return {
    imageId: matchedImages[0]?.id ?? null,
    originalImageUrl: matchedImages[0]?.originalUrl ?? skuUrls[0] ?? null,
    optimizedImageUrl: optimizedUrls[0] ?? null,
    optimizedImageCount: optimizedUrls.length
  };
}

function imageUrlsFromUnknown(value: unknown, depth = 0): string[] {
  if (depth > 7 || value == null) return [];
  if (typeof value === "string") return isImageUrl(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => imageUrlsFromUnknown(item, depth + 1));
  if (typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap((child) => imageUrlsFromUnknown(child, depth + 1));
}

function isImageUrl(value: string) {
  return /^(https?:)?\/\//i.test(value) && (/\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(value) || /(img|image|pic|photo)/i.test(value));
}

function normalizeUrl(url: string) {
  return url.trim().replace(/^http:\/\//i, "https://").replace(/\?.*$/, "");
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
