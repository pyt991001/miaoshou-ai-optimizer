import fs from "node:fs/promises";
import path from "node:path";
import type { MiaoshouProduct } from "@/lib/miaoshou/types";

export type LocalProduct = {
  id: string;
  miaoshouProductId: string;
  originalTitle: string;
  optimizedTitle: string | null;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED" | "UNKNOWN";
  source: string;
  targetPlatform: string;
  category: string | null;
  attributes: Record<string, unknown>;
  description: string | null;
  processingStatus: string;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
  variants: Array<{
    id: string;
    productId: string;
    sku: string;
    name: string | null;
    color: string | null;
    size: string | null;
    imageUrl: string | null;
    rawData: Record<string, unknown>;
  }>;
  images: Array<{
    id: string;
    productId: string;
    type: "MAIN_IMAGE" | "GALLERY_IMAGE" | "SKU_IMAGE" | "DETAIL_IMAGE";
    originalUrl: string;
    localPath: string | null;
    sortOrder: number;
    width: number | null;
    height: number | null;
    format: string | null;
    fileSize: number | null;
    optimizedUrl?: string | null;
    createdAt: Date;
  }>;
};

type StoredLocalProduct = Omit<LocalProduct, "createdAt" | "updatedAt" | "images"> & {
  createdAt: string;
  updatedAt: string;
  images: Array<Omit<LocalProduct["images"][number], "createdAt"> & { createdAt: string }>;
};

const storageFile = path.join(process.cwd(), "storage", "local-products.json");

export async function readLocalProducts(): Promise<LocalProduct[]> {
  try {
    const raw = await fs.readFile(storageFile, "utf8");
    const products = JSON.parse(raw) as StoredLocalProduct[];
    return products.map((product) => ({
      ...product,
      ...normalizeDisplayedStatus(product),
      createdAt: new Date(product.createdAt),
      updatedAt: new Date(product.updatedAt),
      images: product.images.map((image) => ({ ...image, createdAt: new Date(image.createdAt) }))
    }));
  } catch {
    return [];
  }
}

function normalizeDisplayedStatus(product: StoredLocalProduct): Pick<LocalProduct, "processingStatus" | "lastError"> {
  const hasOptimizedImage = product.images.some((image) => Boolean(image.optimizedUrl));
  if (hasOptimizedImage && ["PROCESSING_IMAGES", "FAILED"].includes(product.processingStatus)) {
    return { processingStatus: "WAITING_REVIEW", lastError: null };
  }
  return { processingStatus: product.processingStatus, lastError: product.lastError ?? null };
}

export async function findLocalProduct(productId: string): Promise<LocalProduct | null> {
  const products = await readLocalProducts();
  return products.find((product) => product.id === productId || product.miaoshouProductId === productId) ?? null;
}

export async function updateLocalProductTitle(productId: string, optimizedTitle: string): Promise<LocalProduct | null> {
  const products = await readLocalProducts();
  const index = products.findIndex((product) => product.id === productId || product.miaoshouProductId === productId);
  if (index < 0) return null;
  products[index] = {
    ...products[index],
    optimizedTitle,
    processingStatus: "WAITING_REVIEW",
    lastError: null,
    updatedAt: new Date()
  };
  await fs.mkdir(path.dirname(storageFile), { recursive: true });
  await fs.writeFile(storageFile, JSON.stringify(products, null, 2));
  return products[index];
}

export async function updateLocalProductImages(productId: string): Promise<LocalProduct | null> {
  const products = await readLocalProducts();
  const index = products.findIndex((product) => product.id === productId || product.miaoshouProductId === productId);
  if (index < 0) return null;
  products[index] = {
    ...products[index],
    processingStatus: "WAITING_REVIEW",
    lastError: null,
    updatedAt: new Date(),
    images: products[index].images.map((image) => ({
      ...image,
      optimizedUrl: image.optimizedUrl ?? image.originalUrl
    }))
  };
  await fs.mkdir(path.dirname(storageFile), { recursive: true });
  await fs.writeFile(storageFile, JSON.stringify(products, null, 2));
  return products[index];
}

export async function updateLocalProductOptimizedImages(productId: string, optimizedByImageId: Record<string, string>): Promise<LocalProduct | null> {
  const products = await readLocalProducts();
  const index = products.findIndex((product) => product.id === productId || product.miaoshouProductId === productId);
  if (index < 0) return null;
  products[index] = {
    ...products[index],
    processingStatus: "WAITING_REVIEW",
    lastError: null,
    updatedAt: new Date(),
    images: products[index].images.map((image) => ({
      ...image,
      optimizedUrl: optimizedByImageId[image.id] ?? image.optimizedUrl ?? null
    }))
  };
  await fs.mkdir(path.dirname(storageFile), { recursive: true });
  await fs.writeFile(storageFile, JSON.stringify(products, null, 2));
  return products[index];
}

export async function updateLocalProductStatus(productId: string, processingStatus: string, lastError: string | null = null): Promise<LocalProduct | null> {
  const products = await readLocalProducts();
  const index = products.findIndex((product) => product.id === productId || product.miaoshouProductId === productId);
  if (index < 0) return null;
  products[index] = {
    ...products[index],
    processingStatus,
    lastError,
    updatedAt: new Date()
  };
  await fs.mkdir(path.dirname(storageFile), { recursive: true });
  await fs.writeFile(storageFile, JSON.stringify(products, null, 2));
  return products[index];
}

export async function clearLocalProducts(): Promise<void> {
  await fs.rm(storageFile, { force: true });
}

export async function importMiaoshouProductsLocally(products: MiaoshouProduct[]): Promise<LocalProduct[]> {
  const existing = await readLocalProducts();
  const byMiaoshouId = new Map(existing.map((product) => [product.miaoshouProductId, product]));
  const now = new Date();

  for (const product of products) {
    const previous = byMiaoshouId.get(product.id);
    const id = previous?.id ?? `local-${product.id}`;
    const previousImageByOriginalUrl = new Map(previous?.images.map((image) => [image.originalUrl, image]) ?? []);
    byMiaoshouId.set(product.id, {
      id,
      miaoshouProductId: product.id,
      originalTitle: product.title,
      optimizedTitle: previous?.optimizedTitle ?? null,
      status: product.status,
      source: product.source,
      targetPlatform: product.targetPlatform,
      category: product.category ?? null,
      attributes: product.attributes,
      description: product.description ?? null,
      processingStatus: previous?.processingStatus ?? "PENDING",
      lastError: previous?.lastError ?? null,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      variants: product.variants.map((variant, index) => ({
        id: `${id}-variant-${index}`,
        productId: id,
        sku: variant.sku,
        name: variant.name ?? null,
        color: variant.color ?? null,
        size: variant.size ?? null,
        imageUrl: variant.imageUrl ?? null,
        rawData: variant.rawData
      })),
      images: product.images.map((image, index) => {
        const previousImage = previousImageByOriginalUrl.get(image.url) ?? previous?.images[index];
        return {
          id: image.id || `${id}-image-${index}`,
          productId: id,
          type: image.type,
          originalUrl: image.url,
          localPath: previousImage?.localPath ?? null,
          sortOrder: image.sortOrder,
          width: previousImage?.width ?? null,
          height: previousImage?.height ?? null,
          format: previousImage?.format ?? null,
          fileSize: previousImage?.fileSize ?? null,
          optimizedUrl: previousImage?.optimizedUrl ?? null,
          createdAt: previousImage?.createdAt ?? now
        };
      })
    });
  }

  const next = [...byMiaoshouId.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  await fs.mkdir(path.dirname(storageFile), { recursive: true });
  await fs.writeFile(storageFile, JSON.stringify(next, null, 2));
  return next.filter((product) => products.some((item) => item.id === product.miaoshouProductId));
}
