import fs from "node:fs/promises";
import path from "node:path";
import seed from "../../../prisma/seed-data.json";
import type {
  MiaoshouClient,
  MiaoshouListProductsInput,
  MiaoshouListProductsResult,
  MiaoshouProduct,
  MiaoshouSaveResult,
  MiaoshouTaskStatus,
  MiaoshouUpdateProductInput,
  MiaoshouUploadImageResult
} from "@/lib/miaoshou/types";

function products(): MiaoshouProduct[] {
  return seed.products.map((product) => ({
    id: product.miaoshouProductId,
    title: product.originalTitle,
    status: product.status as MiaoshouProduct["status"],
    source: product.source,
    targetPlatform: product.targetPlatform,
    category: product.category,
    attributes: product.attributes,
    description: product.description,
    images: product.images.map((image, index) => ({
      id: `${product.miaoshouProductId}-IMG-${index}`,
      type: image.type as MiaoshouProduct["images"][number]["type"],
      url: image.originalUrl,
      sortOrder: index
    })),
    variants: product.variants.map((variant) => ({ ...variant, rawData: variant })),
    rawData: product
  }));
}

export class MockMiaoshouClient implements MiaoshouClient {
  async listProducts(input: MiaoshouListProductsInput): Promise<MiaoshouListProductsResult> {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const keyword = input.keyword?.toLowerCase();
    const filtered = products().filter((product) => {
      const matchesKeyword = !keyword || product.title.toLowerCase().includes(keyword) || product.id.toLowerCase().includes(keyword);
      const matchesStatus = !input.status || product.status === input.status;
      return matchesKeyword && matchesStatus;
    });
    return {
      products: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: filtered.length
    };
  }

  async getProduct(productId: string): Promise<MiaoshouProduct> {
    const product = products().find((item) => item.id === productId);
    if (!product) throw new Error(`Mock product not found: ${productId}`);
    return product;
  }

  async updateProductTitle(productId: string, title: string, idempotencyKey: string): Promise<MiaoshouSaveResult> {
    return this.result(productId, "TITLE_UPDATED", { title, idempotencyKey });
  }

  async updateProductImages(productId: string, imageUrls: string[], idempotencyKey: string): Promise<MiaoshouSaveResult> {
    return this.result(productId, "IMAGES_UPDATED", { imageUrls, idempotencyKey });
  }

  async updateProduct(input: MiaoshouUpdateProductInput): Promise<MiaoshouSaveResult> {
    return this.result(input.productId, "PRODUCT_UPDATED", input as unknown as Record<string, unknown>);
  }

  async saveToPublicCollectionBox(productId: string, idempotencyKey: string): Promise<MiaoshouSaveResult> {
    return this.result(productId, "SAVED_TO_PUBLIC_BOX", { idempotencyKey });
  }

  async saveToPlatformCollectionBox(productId: string, targetBox: string, idempotencyKey: string): Promise<MiaoshouSaveResult> {
    return this.result(productId, "SAVED_TO_PLATFORM_BOX", { targetBox, idempotencyKey });
  }

  async publishProduct(productId: string, idempotencyKey: string): Promise<MiaoshouSaveResult> {
    return this.result(productId, "PUBLISH_TASK_CREATED", { idempotencyKey });
  }

  async uploadImage(buffer: Buffer, filename: string): Promise<MiaoshouUploadImageResult> {
    const dir = path.join(process.cwd(), "storage", "mock-miaoshou");
    await fs.mkdir(dir, { recursive: true });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fullPath = path.join(dir, safeName);
    await fs.writeFile(fullPath, buffer);
    return {
      url: `/mock-miaoshou/${safeName}`,
      rawResponse: { ok: true, size: buffer.byteLength }
    };
  }

  async getTaskStatus(taskId: string): Promise<MiaoshouTaskStatus> {
    return {
      taskId,
      status: "COMPLETED",
      rawResponse: { mock: true }
    };
  }

  private result(productId: string, status: string, rawResponse: Record<string, unknown>): MiaoshouSaveResult {
    return {
      productId,
      taskId: `mock-task-${productId}-${Date.now()}`,
      status,
      rawResponse
    };
  }
}
