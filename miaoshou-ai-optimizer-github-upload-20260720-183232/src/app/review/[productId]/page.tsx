import { ReviewActions } from "@/components/review-actions";
import { ReviewImageSelector } from "@/components/review-image-selector";
import { prisma } from "@/lib/db/prisma";
import { safeQuery } from "@/lib/db/safe-query";
import { findLocalProduct, type LocalProduct } from "@/lib/products/local-store";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const dbProduct = await safeQuery(
    () =>
      prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: true,
          images: { include: { optimizations: true }, orderBy: { sortOrder: "asc" } },
          titleOptimizations: { orderBy: { createdAt: "desc" } },
          syncRecords: { orderBy: { createdAt: "desc" } }
        }
      }),
    null,
    "review-page"
  );
  const localProduct = dbProduct ? null : await findLocalProduct(productId);
  const product = dbProduct ?? (localProduct ? toReviewProduct(localProduct) : null);
  if (!product) return <div>商品不存在</div>;
  const latestTitle = product.titleOptimizations[0];
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">商品处理结果对比</h1>
          <p className="text-sm text-slate-600">{product.miaoshouProductId}</p>
        </div>
        <ReviewActions productId={product.id} titleOptimizationId={latestTitle?.id} />
      </div>
      <div className="space-y-4">
        <section className="panel p-5">
          <h2 className="font-semibold">原始数据</h2>
          <div className="mt-4 text-sm text-slate-500">原标题</div>
          <p className="mt-1">{product.originalTitle}</p>
          <div className="mt-4">
            <ReviewImageSelector
              productId={product.id}
              images={product.images.map((image) => ({
                id: image.id,
                originalUrl: image.originalUrl,
                type: image.type,
                width: image.width,
                height: image.height,
                sortOrder: image.sortOrder,
                optimizedUrl: image.optimizations?.[0]?.optimizedUrl ?? null
              }))}
              variants={product.variants.map((variant) => ({
                id: variant.id,
                sku: variant.sku,
                name: variant.name,
                color: variant.color,
                size: variant.size,
                imageUrl: variant.imageUrl,
                imageUrls: uniqueStrings([variant.imageUrl, ...imageUrlsFromUnknown(variant.rawData)])
              }))}
            />
          </div>
          <pre className="mt-4 overflow-auto rounded bg-cloud p-3 text-xs">{JSON.stringify(product.attributes, null, 2)}</pre>
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold">优化后数据</h2>
          <div className="mt-4 text-sm text-slate-500">优化标题</div>
          <p className="mt-1">{latestTitle?.optimizedTitle ?? "尚未生成"}</p>
          <div className="mt-2 text-xs text-slate-500">
            置信度 {latestTitle?.confidence ?? 0}，审核状态 {latestTitle?.decision ?? "PENDING"}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {product.images.map((image) => {
              const optimization = image.optimizations?.[0];
              return (
                <div key={image.id} className="rounded-md border border-line p-2">
                  <div className="mb-2 text-xs font-medium text-emerald-700">优化图</div>
                  {optimization?.optimizedUrl ? <img src={optimization.optimizedUrl} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded object-cover" /> : <div className="grid aspect-square place-items-center rounded bg-cloud text-sm text-slate-500">待生成</div>}
                  <div className="mt-2 text-xs text-slate-500">一致性分数 {optimization?.consistencyScore ?? "-"}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
            风险提示：未配置 OpenAI Key 时会使用 Mock 结果。发布到店铺必须走独立按钮和二次确认。
          </div>
        </section>
      </div>
    </div>
  );
}

function toReviewProduct(product: LocalProduct) {
  return {
    ...product,
    titleOptimizations: [],
    syncRecords: [],
    images: product.images.map((image) => ({
      ...image,
      optimizations: image.optimizedUrl
        ? [
            {
              id: `${image.id}-local-optimization`,
              productImageId: image.id,
              originalUrl: image.originalUrl,
              optimizedUrl: image.optimizedUrl,
              optimizedLocalPath: null,
              openaiRequestId: null,
              model: "gpt-image-2",
              prompt: "OpenAI image edit",
              imageType: image.type,
              processingMs: null,
              apiCostUsd: 0,
              consistencyScore: null,
              validationReport: null,
              failureReason: null,
              userConfirmed: false,
              decision: "PENDING",
              createdAt: image.createdAt
            }
          ]
        : []
    }))
  };
}

function imageUrlsFromUnknown(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") return isImageUrl(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => imageUrlsFromUnknown(item, depth + 1));
  if (typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (!/(img|image|pic|picture|thumbnail|photo|detail|sku|spec|url)/i.test(key)) return [];
    return imageUrlsFromUnknown(child, depth + 1);
  });
}

function isImageUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("//");
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
