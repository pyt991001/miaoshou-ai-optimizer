import { ImportProductsButton } from "@/components/import-products-button";
import { ProductsTable } from "@/components/products-table";
import { prisma } from "@/lib/db/prisma";
import { safeQuery } from "@/lib/db/safe-query";
import { readLocalProducts } from "@/lib/products/local-store";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const dbProducts = await safeQuery(
    () =>
      prisma.product.findMany({
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
  const localProducts = dbProducts.length === 0 ? await readLocalProducts() : [];
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
          skuList: product.variants.map((variant) => ({
            sku: variant.sku,
            name: variant.name,
            color: variant.color,
            size: variant.size,
            imageUrl: variant.imageUrl
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
    skuList: product.variants.map((variant) => ({
      sku: variant.sku,
      name: variant.name,
      color: variant.color,
      size: variant.size,
      imageUrl: variant.imageUrl
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
