import { z } from "zod";

export const MiaoshouProductStatusSchema = z.enum(["ACTIVE", "DRAFT", "ARCHIVED", "UNKNOWN"]);
export type MiaoshouProductStatus = z.infer<typeof MiaoshouProductStatusSchema>;

export const MiaoshouImageTypeSchema = z.enum(["MAIN_IMAGE", "GALLERY_IMAGE", "SKU_IMAGE", "DETAIL_IMAGE"]);
export type MiaoshouImageType = z.infer<typeof MiaoshouImageTypeSchema>;

export interface MiaoshouProductImage {
  id: string;
  type: MiaoshouImageType;
  url: string;
  sortOrder: number;
}

export interface MiaoshouProductVariant {
  sku: string;
  name?: string;
  color?: string;
  size?: string;
  imageUrl?: string;
  rawData: Record<string, unknown>;
}

export interface MiaoshouProduct {
  id: string;
  title: string;
  status: MiaoshouProductStatus;
  source: string;
  targetPlatform: string;
  category?: string;
  attributes: Record<string, unknown>;
  description?: string;
  images: MiaoshouProductImage[];
  variants: MiaoshouProductVariant[];
  rawData: Record<string, unknown>;
}

export interface MiaoshouListProductsInput {
  keyword?: string;
  status?: MiaoshouProductStatus;
  page?: number;
  pageSize?: number;
}

export interface MiaoshouListProductsResult {
  products: MiaoshouProduct[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MiaoshouUpdateProductInput {
  productId: string;
  title?: string;
  imageUrls?: string[];
  attributes?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface MiaoshouUploadImageResult {
  url: string;
  rawResponse: Record<string, unknown>;
}

export interface MiaoshouSaveResult {
  productId: string;
  taskId?: string;
  status: string;
  rawResponse: Record<string, unknown>;
}

export interface MiaoshouTaskStatus {
  taskId: string;
  status: string;
  message?: string;
  rawResponse: Record<string, unknown>;
}

export interface MiaoshouClient {
  listProducts(input: MiaoshouListProductsInput): Promise<MiaoshouListProductsResult>;
  getProduct(productId: string): Promise<MiaoshouProduct>;
  updateProductTitle(productId: string, title: string, idempotencyKey: string): Promise<MiaoshouSaveResult>;
  updateProductImages(productId: string, imageUrls: string[], idempotencyKey: string): Promise<MiaoshouSaveResult>;
  updateProduct(input: MiaoshouUpdateProductInput): Promise<MiaoshouSaveResult>;
  saveToPublicCollectionBox(productId: string, idempotencyKey: string): Promise<MiaoshouSaveResult>;
  saveToPlatformCollectionBox(productId: string, targetBox: string, idempotencyKey: string): Promise<MiaoshouSaveResult>;
  publishProduct(productId: string, idempotencyKey: string): Promise<MiaoshouSaveResult>;
  uploadImage(buffer: Buffer, filename: string, mimeType: string, idempotencyKey: string): Promise<MiaoshouUploadImageResult>;
  getTaskStatus(taskId: string): Promise<MiaoshouTaskStatus>;
}

export interface MiaoshouConfig {
  baseUrl?: string;
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  shopId?: string;
  targetBox?: string;
  targetPlatform?: "public" | "shopee" | "tiktok" | "shein";
  targetSite?: string;
}
