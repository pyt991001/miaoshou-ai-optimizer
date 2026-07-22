import { getEnv } from "@/lib/config/env";
import { mapMiaoshouError, MiaoshouApiError } from "@/lib/miaoshou/errors";
import { createMiaoshouSignature } from "@/lib/miaoshou/signature";
import type {
  MiaoshouClient,
  MiaoshouConfig,
  MiaoshouListProductsInput,
  MiaoshouListProductsResult,
  MiaoshouProduct,
  MiaoshouProductStatus,
  MiaoshouSaveResult,
  MiaoshouTaskStatus,
  MiaoshouUpdateProductInput,
  MiaoshouUploadImageResult
} from "@/lib/miaoshou/types";
import { MockMiaoshouClient } from "@/lib/miaoshou/mock-client";
import { retryWithBackoff } from "@/lib/utils/retry";
import { logger } from "@/lib/utils/logger";

const DEFAULT_BASE_URL = "https://openapi-erp.91miaoshou.com";

const ENDPOINTS = {
  publicList: "/open/v1/product/common_collect_box/common_collect_box/get_common_collect_box_list",
  publicDetail: "/open/v1/product/common_collect_box/common_collect_box/get_common_collect_box_detail",
  publicEdit: "/open/v1/product/common_collect_box/common_collect_box/edit_common_collect_box_detail",
  publicClaim: "/open/v1/product/common_collect_box/common_collect_box/claimed",
  shopeeList: "/open/v1/product/collect_box/shopee/collect_box/search_collect_box_detail_list",
  shopeeDetail: "/open/v1/product/collect_box/shopee/collect_box/get_collect_box_item_detail",
  shopeeEdit: "/open/v1/product/collect_box/shopee/collect_box/save_edit_item",
  shopeePublish: "/open/v1/product/collect_box/shopee/move_collect/save_move_collect_task",
  tiktokList: "/open/v1/product/collect_box/tiktok/collect_box/search_collect_box_detail_list",
  tiktokDetail: "/open/v1/product/collect_box/tiktok/collect_box/get_shop_collect_item_info",
  tiktokEdit: "/open/v1/product/collect_box/tiktok/collect_box/save_shop_collect_item_info",
  tiktokPublish: "/open/v1/product/collect_box/tiktok/collect_box/save_move_collect_task"
} as const;

type ApiEnvelope<T> = {
  result?: string;
  code?: string;
  message?: string;
  data?: T;
};

type SourcePlatform = "public" | "shopee" | "tiktok";
type ClaimPlatform = SourcePlatform | "shein";
type JsonRecord = Record<string, unknown>;

export function getMiaoshouConfig(): MiaoshouConfig {
  const env = getEnv();
  const inferredPlatform = inferSourcePlatform(env.MIAOSHOU_TARGET_PLATFORM, env.MIAOSHOU_TARGET_BOX);
  return {
    baseUrl: env.MIAOSHOU_API_BASE_URL || DEFAULT_BASE_URL,
    appKey: env.MIAOSHOU_APP_KEY,
    appSecret: env.MIAOSHOU_APP_SECRET,
    accessToken: env.MIAOSHOU_ACCESS_TOKEN,
    refreshToken: env.MIAOSHOU_REFRESH_TOKEN,
    shopId: env.MIAOSHOU_SHOP_ID,
    targetBox: env.MIAOSHOU_TARGET_BOX || (env.MIAOSHOU_TARGET_PLATFORM === "shein" ? "shein" : undefined),
    targetPlatform: inferredPlatform,
    targetSite: env.MIAOSHOU_TARGET_SITE
  };
}

export function createMiaoshouClient(): MiaoshouClient {
  const env = getEnv();
  if (env.MIAOSHOU_MODE === "real") {
    return new RealMiaoshouClient(getMiaoshouConfig());
  }
  return new MockMiaoshouClient();
}

export class RealMiaoshouClient implements MiaoshouClient {
  constructor(private readonly config: MiaoshouConfig) {}

  private get platform(): SourcePlatform {
    return inferSourcePlatform(this.config.targetPlatform, this.config.targetBox);
  }

  async listShops(platform: string, site?: string): Promise<Array<Record<string, unknown>>> {
    const raw = await this.request<{ shopList?: unknown[] }>("/open/v1/product/shop/shop/get_shop_list", {
      platform,
      ...(site ? { site } : {}),
      pageNo: 1,
      pageSize: 100
    });
    const data = asRecord(raw.data);
    return Array.isArray(data.shopList) ? data.shopList.map((shop) => asRecord(shop)) : [];
  }

  private async request<T>(apiPath: string, body: unknown = {}, idempotencyKey?: string): Promise<ApiEnvelope<T>> {
    if (!this.config.baseUrl || !this.config.appKey || !this.config.appSecret) {
      throw new MiaoshouApiError("请先配置 MIAOSHOU_API_BASE_URL、MIAOSHOU_APP_KEY、MIAOSHOU_APP_SECRET", "MISSING_CONFIG", false);
    }

    const bodyJson = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createMiaoshouSignature({
      path: apiPath,
      timestamp,
      appKey: this.config.appKey,
      appSecret: this.config.appSecret,
      bodyJson
    });

    const url = new URL(apiPath, this.config.baseUrl);
    logger.info({ path: apiPath, idempotencyKey }, "Calling Miaoshou API");

    return retryWithBackoff(
      async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-app-key": this.config.appKey ?? "",
            "x-timestamp": timestamp,
            "x-sign": signature,
            "idempotency-key": idempotencyKey ?? ""
          },
          body: bodyJson,
          signal: AbortSignal.timeout(30_000)
        });
        const raw = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
        const successCode = !raw.code || raw.code === "success";
        const successResult = !raw.result || raw.result === "success";
        if (!response.ok || !successCode || !successResult) {
          throw mapMiaoshouError(String(raw.code ?? response.status), String(raw.message ?? response.statusText), raw);
        }
        return raw;
      },
      {
        attempts: 3,
        isRetryable: (error) => error instanceof MiaoshouApiError && error.retryable
      }
    );
  }

  async listProducts(input: MiaoshouListProductsInput = {}): Promise<MiaoshouListProductsResult> {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 50, 500);
    const body = {
      pageNo: page,
      pageSize,
      filter: buildListFilter(input, this.platform)
    };
    const endpoint = this.platform === "shopee" ? ENDPOINTS.shopeeList : this.platform === "tiktok" ? ENDPOINTS.tiktokList : ENDPOINTS.publicList;
    const raw = await this.request<{ detailList?: unknown[]; total?: number }>(endpoint, body);
    const data = asRecord(raw.data);
    const list = Array.isArray(data.detailList) ? data.detailList : [];
    const summaries = list.map((item) => this.mapProduct(asRecord(item)));
    // The detail endpoint enforces an account-level QPS limit. Parallel detail
    // requests cause otherwise valid products to fall back to list summaries,
    // which do not contain SKU variants or SKU images.
    const products = await mapWithConcurrency(summaries, 1, async (summary) => {
      if (!summary.id) return summary;
      try {
        const detail = await this.getProduct(summary.id);
        return {
          ...summary,
          ...detail,
          id: summary.id,
          source: detail.source || summary.source,
          targetPlatform: detail.targetPlatform || summary.targetPlatform
        };
      } catch (error) {
        logger.warn({ productId: summary.id, error }, "Miaoshou detail fetch failed; using list item images only");
        return summary;
      }
    });
    return {
      products,
      page,
      pageSize,
      total: typeof data.total === "number" ? data.total : list.length
    };
  }

  async getProduct(productId: string): Promise<MiaoshouProduct> {
    const detail = await this.getEditableDetail(productId);
    return this.mapProduct(detail.editable, detail.raw);
  }

  async updateProductTitle(productId: string, title: string, idempotencyKey: string): Promise<MiaoshouSaveResult> {
    return this.updateProduct({ productId, title, idempotencyKey });
  }

  async updateProductImages(productId: string, imageUrls: string[], idempotencyKey: string): Promise<MiaoshouSaveResult> {
    return this.updateProduct({ productId, imageUrls, idempotencyKey });
  }

  async updateProduct(input: MiaoshouUpdateProductInput): Promise<MiaoshouSaveResult> {
    const detail = await this.getEditableDetail(input.productId);
    const merged = applyOptimizedImagesToEditableDetail({
      ...detail.editable,
      ...(input.title ? { title: input.title } : {}),
      ...(input.imageUrls?.length ? { imgUrls: input.imageUrls } : {}),
      ...(input.attributes ?? {})
    }, input.imageUrls);

    if (this.platform === "public") {
      const ossMd5 = stringValue(detail.raw.ossMd5);
      if (!ossMd5) {
        throw new MiaoshouApiError("公共采集箱保存失败：详情接口没有返回 ossMd5，无法提交编辑。请重新导入该商品后再保存。", "MISSING_OSS_MD5", false, detail.raw);
      }
      const raw = await this.request(ENDPOINTS.publicEdit, {
        commonCollectBoxDetailId: Number(input.productId),
        ossMd5,
        editCommonCollectBoxDetail: merged
      }, input.idempotencyKey);
      return this.saveResult(input.productId, "PUBLIC_COLLECTION_BOX_UPDATED", raw);
    }

    if (this.platform === "shopee") {
      const raw = await this.request(ENDPOINTS.shopeeEdit, {
        collectBoxDetailId: input.productId,
        itemDetail: merged
      }, input.idempotencyKey);
      return this.saveResult(input.productId, "SHOPEE_COLLECTION_BOX_UPDATED", raw);
    }

    const raw = await this.request<{ ossMd5?: string }>(ENDPOINTS.tiktokEdit, {
      ossMd5: stringValue(detail.raw.ossMd5),
      shopCollectItemInfo: merged
    }, input.idempotencyKey);
    return this.saveResult(input.productId, "TIKTOK_COLLECTION_BOX_UPDATED", raw);
  }

  async saveToPublicCollectionBox(productId: string, idempotencyKey: string): Promise<MiaoshouSaveResult> {
    if (this.platform === "public") {
      return this.saveResult(productId, "ALREADY_IN_PUBLIC_COLLECTION_BOX", { result: "success", code: "success", data: { productId, idempotencyKey } });
    }
    throw new MiaoshouApiError("当前文档没有提供“平台采集箱反向保存到公共采集箱”的接口；请从公共采集箱导入，或先在妙手内完成该动作。", "NOT_IMPLEMENTED", false);
  }

  async saveToPlatformCollectionBox(productId: string, targetBox: string, idempotencyKey: string): Promise<MiaoshouSaveResult> {
    const platform = inferClaimPlatform(targetBox, this.config.targetPlatform);
    if (this.platform !== "public") {
      return this.saveResult(productId, `ALREADY_IN_${platform.toUpperCase()}_COLLECTION_BOX`, { result: "success", code: "success", data: { productId, platform, idempotencyKey } });
    }
    const raw = await this.request(ENDPOINTS.publicClaim, {
      detailSerialNumberPlatformList: [
        {
          detailId: Number(productId),
          platform,
          serialNumber: 1
        }
      ]
    }, idempotencyKey);
    return this.saveResult(productId, `${platform.toUpperCase()}_COLLECTION_BOX_CLAIMED`, raw);
  }

  async publishProduct(productId: string, idempotencyKey: string): Promise<MiaoshouSaveResult> {
    const shopIds = parseIdList(this.config.shopId);
    if (shopIds.length === 0) {
      throw new MiaoshouApiError("发布商品前请配置 MIAOSHOU_SHOP_ID；多个店铺用英文逗号分隔。", "MISSING_SHOP_ID", false);
    }
    if (this.platform === "public") {
      throw new MiaoshouApiError("公共采集箱不能直接发布；请先认领到平台采集箱。SHEIN 当前只支持保存到采集箱，不执行发布。", "UNSUPPORTED_PLATFORM", false);
    }

    const endpoint = this.platform === "shopee" ? ENDPOINTS.shopeePublish : ENDPOINTS.tiktokPublish;
    const raw = await this.request(endpoint, {
      shopIds,
      detailIds: [Number(productId)]
    }, idempotencyKey);
    return this.saveResult(productId, `${this.platform.toUpperCase()}_PUBLISH_SUBMITTED`, raw, firstTaskId(raw.data));
  }

  async uploadImage(): Promise<MiaoshouUploadImageResult> {
    throw new MiaoshouApiError("当前 Apifox 商品开放接口没有暴露图片上传接口；回写商品图片时请使用可公网访问的图片 URL。", "NOT_IMPLEMENTED", false);
  }

  async getTaskStatus(taskId: string): Promise<MiaoshouTaskStatus> {
    return {
      taskId,
      status: "UNKNOWN",
      message: "当前 Apifox 商品开放接口没有暴露发布任务查询接口，请在妙手后台查看发布结果。",
      rawResponse: { taskId }
    };
  }

  private async getEditableDetail(productId: string): Promise<{ editable: JsonRecord; raw: JsonRecord }> {
    if (this.platform === "public") {
      const raw = await this.request<{ editCommonCollectBoxDetail?: JsonRecord; ossMd5?: string }>(ENDPOINTS.publicDetail, {
        commonCollectBoxDetailId: Number(productId)
      });
      const data = asRecord(raw.data);
      return { editable: asRecord(data.editCommonCollectBoxDetail), raw: data };
    }

    if (this.platform === "shopee") {
      const raw = await this.request<{ itemDetail?: JsonRecord }>(ENDPOINTS.shopeeDetail, { detailId: Number(productId) });
      const data = asRecord(raw.data);
      return { editable: asRecord(data.itemDetail), raw: data };
    }

    const shopId = Number(this.config.shopId);
    if (!Number.isFinite(shopId)) {
      throw new MiaoshouApiError("读取 TikTok 采集箱详情前请配置 MIAOSHOU_SHOP_ID。", "MISSING_SHOP_ID", false);
    }
    const raw = await this.request<{ shopCollectItemInfo?: JsonRecord; ossMd5?: string }>(ENDPOINTS.tiktokDetail, {
      detailId: Number(productId),
      shopId
    });
    const data = asRecord(raw.data);
    return { editable: asRecord(data.shopCollectItemInfo), raw: data };
  }

  private mapProduct(item: JsonRecord, raw: JsonRecord = item): MiaoshouProduct {
    const id = stringValue(item.commonCollectBoxDetailId ?? item.collectBoxDetailId ?? item.detailId ?? item.id) ?? "";
    const variants = variantsFrom(
      item.skuMap ?? item.skuList ?? item.skus ?? item.variantList ?? item.variants ?? item.specList,
      item,
      raw
    );
    const variantImageUrls = uniqueStrings(
      variants.flatMap((variant) => [variant.imageUrl, ...imageUrlsFromUnknown(variant.rawData)]).filter(isPublicImageUrl)
    );
    const variantImageKeys = new Set(variantImageUrls.map(normalizeComparableUrl));
    const images = uniqueStrings([...imageUrlsFrom(item), ...imageUrlsFrom(raw), ...variantImageUrls]);
    return {
      id,
      title: stringValue(item.title ?? item.oriTitle ?? item.itemName) ?? "未命名商品",
      status: mapStatus(stringValue(item.status)),
      source: stringValue(item.source ?? firstSource(item)?.source) ?? "miaoshou",
      targetPlatform: stringValue(item.platform) ?? this.platform,
      category: stringValue(item.cid ?? item.categoryId),
      attributes: asRecord(item.sourceAttrs ?? item.productAttributes ?? {}),
      description: stringValue(item.notes ?? item.notesText ?? item.richTextDesc),
      images: images.map((url, index) => ({
        id: `${id || "image"}-${index}`,
        type: index === 0 ? "MAIN_IMAGE" : variantImageKeys.has(normalizeComparableUrl(url)) ? "SKU_IMAGE" : "GALLERY_IMAGE",
        url,
        sortOrder: index
      })),
      variants,
      rawData: raw
    };
  }

  private saveResult(productId: string, status: string, rawResponse: unknown, taskId?: string): MiaoshouSaveResult {
    return {
      productId,
      taskId,
      status,
      rawResponse: asRecord(rawResponse)
    };
  }
}

function applyOptimizedImagesToEditableDetail(editable: JsonRecord, imageUrls?: string[]): JsonRecord {
  const urls = uniqueStrings(imageUrls ?? []);
  const firstOptimizedUrl = urls[0];
  if (!firstOptimizedUrl) return editable;

  const next: JsonRecord = { ...editable };
  const touched: string[] = [];

  for (const key of ["imgUrls", "imagePaths"]) {
    if (key in next) {
      next[key] = urls;
      touched.push(key);
    }
  }

  for (const key of ["thumbnail", "listThumbnail", "imgUrl", "imageUrl", "mainImgUrl", "mainImageUrl", "picUrl", "pictureUrl"]) {
    if (typeof next[key] === "string") {
      next[key] = firstOptimizedUrl;
      touched.push(key);
    }
  }

  for (const key of [
    "skuImages",
    "skuImageList",
    "skuImageMap",
    "skuImgUrls",
    "skuPictureUrls",
    "skuPics",
    "specImages",
    "specImageList",
    "specImgUrls",
    "specPictureUrls",
    "detailImgUrls",
    "detailImageUrls",
    "detailImages",
    "productDetailImages",
    "skuDetailImages",
    "mainSpecDetailImages",
    "mainSpecificationDetailImages",
    "mainSkuDetailImages"
  ]) {
    if (key in next) {
      next[key] = replaceFirstImageValue(next[key], firstOptimizedUrl);
      touched.push(key);
    }
  }

  const skuMap = asRecord(next.skuMap);
  const skuKeys = Object.keys(skuMap);
  if (skuKeys.length > 0) {
    next.skuMap = Object.fromEntries(
      skuKeys.map((skuKey) => [skuKey, replaceSkuFirstImage(asRecord(skuMap[skuKey]), firstOptimizedUrl)])
    );
    touched.push(`skuMap.${skuKeys.length}_items`);
  }

  logger.info({ imageFieldUpdates: touched, firstOptimizedUrl }, "Prepared Miaoshou editable image fields");
  return next;
}

function replaceFirstImageValue(value: unknown, imageUrl: string): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return [imageUrl];
    const [first, ...rest] = value;
    if (typeof first === "string") return [imageUrl, ...rest.filter((item) => item !== imageUrl)];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return [replaceImageFieldsInRecord(first as JsonRecord, imageUrl, true), ...rest];
    }
    return [imageUrl, ...rest];
  }

  if (typeof value === "string") return imageUrl;

  if (value && typeof value === "object") {
    return replaceImageFieldsInRecord(value as JsonRecord, imageUrl, true);
  }

  return value;
}

function replaceImageFieldsInRecord(record: JsonRecord, imageUrl: string, allowCreate = false): JsonRecord {
  const next: JsonRecord = { ...record };
  const keys = ["imgUrl", "imageUrl", "url", "picUrl", "pictureUrl", "thumbnail", "mainImgUrl", "mainImageUrl"];
  let changed = false;
  for (const key of keys) {
    if (typeof next[key] === "string") {
      next[key] = imageUrl;
      changed = true;
    }
  }
  if (!changed && allowCreate) next.imgUrl = imageUrl;
  return changed || allowCreate ? next : record;
}

function replaceSkuFirstImage(sku: JsonRecord, imageUrl: string): JsonRecord {
  const next = replaceImageFieldsInRecord(sku, imageUrl, true);

  for (const key of [
    "imgUrls",
    "imageUrls",
    "images",
    "pictures",
    "picUrls",
    "skuImgUrls",
    "skuImages",
    "detailImgUrls",
    "detailImageUrls",
    "detailImages"
  ]) {
    if (key in next) next[key] = replaceFirstImageValue(next[key], imageUrl);
  }

  return next;
}

function uniqueStrings(value: string[]): string[] {
  return [...new Set(value.filter((item) => typeof item === "string" && item.length > 0))];
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function inferSourcePlatform(platform?: string, targetBox?: string): SourcePlatform {
  const value = (platform || targetBox || "public").toLowerCase();
  if (value.includes("shopee")) return "shopee";
  if (value.includes("tiktok") || value.includes("tk")) return "tiktok";
  return "public";
}

function inferClaimPlatform(targetBox?: string, platform?: string): ClaimPlatform {
  const value = (targetBox || platform || "public").toLowerCase();
  if (value.includes("shein")) return "shein";
  if (value.includes("shopee")) return "shopee";
  if (value.includes("tiktok") || value.includes("tk")) return "tiktok";
  return "public";
}

function buildListFilter(input: MiaoshouListProductsInput, platform: SourcePlatform): JsonRecord {
  const keywordKey = "sourceItemIdKeyword";
  if (platform === "public") {
    return {
      tabPaneName: input.status === "ACTIVE" ? "collectSuccess" : "all",
      ...(input.keyword ? { [keywordKey]: input.keyword } : {})
    };
  }
  return {
    status: input.status === "ACTIVE" ? "published" : input.status === "DRAFT" ? "notPublished" : undefined,
    ...(input.keyword ? { [keywordKey]: input.keyword } : {})
  };
}

function mapStatus(status?: string): MiaoshouProductStatus {
  const value = (status ?? "").toLowerCase();
  if (["active", "published", "collectsuccess", "success"].includes(value)) return "ACTIVE";
  if (["draft", "notpublished", "nlaimed", "noclaimed", "timingpublish"].includes(value)) return "DRAFT";
  if (["archived", "deleted"].includes(value)) return "ARCHIVED";
  return "UNKNOWN";
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function imageUrlsFrom(item: JsonRecord): string[] {
  const urls = [
    ...arrayOfStrings(item.imgUrls),
    ...arrayOfStrings(item.imagePaths),
    ...arrayOfStrings(item.imageUrls),
    ...arrayOfStrings(item.picUrls),
    ...arrayOfStrings(item.pictureUrls),
    ...arrayOfStrings(item.detailImgUrls),
    ...arrayOfStrings(item.detailImageUrls),
    ...arrayOfStrings(item.productDetailImages),
    ...arrayOfStrings(item.skuDetailImages),
    ...arrayOfStrings(item.mainSpecDetailImages),
    ...arrayOfStrings(item.mainSpecificationDetailImages),
    ...arrayOfStrings(item.mainSkuDetailImages),
    ...imageUrlsFromUnknown(item.detailImages),
    ...imageUrlsFromUnknown(item.skuImages),
    ...imageUrlsFromUnknown(item.skuImageList),
    ...imageUrlsFromUnknown(item.skuImageMap),
    ...imageUrlsFromUnknown(item.specImages),
    ...imageUrlsFromUnknown(item.specImageList),
    ...imageUrlsFromUnknown(item.skuMap),
    stringValue(item.thumbnail),
    stringValue(item.listThumbnail),
    stringValue(item.imgUrl),
    stringValue(item.imageUrl),
    stringValue(item.picUrl),
    stringValue(item.pictureUrl),
    stringValue(item.mainImgUrl),
    stringValue(item.mainImageUrl),
    stringValue(item.mainPicUrl),
    stringValue(item.mainPictureUrl),
    stringValue(item.cover),
    stringValue(item.coverUrl),
    stringValue(item.photoUrl),
    stringValue(item.productImageUrl),
    ...imageUrlsFromUnknown(item)
  ].map(normalizeImageUrl).filter(isPublicImageUrl);
  return uniqueStrings(urls);
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(stringValue).filter((item): item is string => Boolean(item)) : [];
}

function imageUrlsFromUnknown(value: unknown, parentKey = "", depth = 0): string[] {
  if (depth > 8 || value == null) return [];

  if (typeof value === "string") {
    const normalized = normalizeImageUrl(value);
    return isPublicImageUrl(normalized) && (looksLikeImageField(parentKey) || isLikelyImageUrl(normalized)) ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => imageUrlsFromUnknown(item, parentKey, depth + 1));
  }

  if (typeof value !== "object") return [];

  return Object.entries(value as JsonRecord).flatMap(([key, child]) => {
    const nextKey = parentKey ? `${parentKey}.${key}` : key;
    if (typeof child === "string") {
      const normalized = normalizeImageUrl(child);
      return isPublicImageUrl(normalized) && (looksLikeImageField(key) || isLikelyImageUrl(normalized)) ? [normalized] : [];
    }
    return imageUrlsFromUnknown(child, nextKey, depth + 1);
  });
}

function looksLikeImageField(key: string): boolean {
  return /(img|image|pic|picture|thumbnail|photo|detail|sku|spec)/i.test(key);
}

function normalizeImageUrl(value: unknown): string | undefined {
  const raw = stringValue(value);
  if (!raw) return undefined;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return raw;
}

function isPublicImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return /\.(avif|gif|jpeg|jpg|png|webp)(\?.*)?$/i.test(url.pathname + url.search) || /img|image|pic|photo|thumbnail/i.test(url.hostname + url.pathname);
  } catch {
    return false;
  }
}

function isLikelyImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return /\.(avif|gif|jpeg|jpg|png|webp)(\?.*)?$/i.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

function normalizeComparableUrl(url: string): string {
  return url.trim().replace(/^http:\/\//i, "https://").replace(/\?.*$/, "");
}

type SkuImageCandidate = {
  keys: string[];
  imageUrls: string[];
};

function variantsFrom(value: unknown, item?: JsonRecord, raw?: JsonRecord): MiaoshouProduct["variants"] {
  const entries = variantEntriesFrom(value);
  const skuImageCandidates = skuImageCandidatesFromUnknown([item, raw]);
  return entries.map(([sku, raw]) => {
    const record = asRecord(raw);
    const variantSku = stringValue(record.itemNum) ?? sku;
    const variantKeys = variantMatchKeys(variantSku, sku, record);
    const matchedCandidates = skuImageCandidates.filter((candidate) => hasCommonVariantKey(variantKeys, candidate.keys));
    const skuImages = uniqueStrings([
      ...imageUrlsFromUnknown(record),
      ...matchedCandidates.flatMap((candidate) => candidate.imageUrls)
    ]);
    return {
      sku: variantSku,
      name: sku,
      color: stringValue(record.colorPropName),
      size: stringValue(record.sizePropName),
      imageUrl: skuImages[0] ?? normalizeImageUrl(record.imgUrl),
      rawData: {
        ...record,
        ...(skuImages.length > 0 ? { skuImageUrls: skuImages } : {}),
        ...(matchedCandidates.length > 0
          ? { skuImageMatchedKeys: uniqueStrings(matchedCandidates.flatMap((candidate) => candidate.keys)) }
          : {})
      }
    };
  });
}

function variantEntriesFrom(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((raw, index) => {
      const record = asRecord(raw);
      const key =
        stringValue(record.itemNum ?? record.sku ?? record.skuId ?? record.skuCode ?? record.sellerSku ?? record.variantId) ??
        `sku-${index + 1}`;
      return [key, raw];
    });
  }

  const record = asRecord(value);
  for (const key of ["list", "items", "rows", "data", "skuList", "skus", "variants"]) {
    if (Array.isArray(record[key])) return variantEntriesFrom(record[key]);
  }
  return Object.entries(record);
}

function skuImageCandidatesFromUnknown(value: unknown, parentKeys: string[] = [], depth = 0): SkuImageCandidate[] {
  if (depth > 8 || value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => skuImageCandidatesFromUnknown(item, parentKeys, depth + 1));
  }

  if (typeof value !== "object") return [];

  const record = asRecord(value);
  const recordKeys = variantKeysFromRecord(record);
  const keys = uniqueStrings([...parentKeys, ...recordKeys].map(cleanVariantKey).filter(Boolean));
  const imageUrls = uniqueStrings(imageUrlsFromUnknown(record));
  const ownCandidate = imageUrls.length > 0 && keys.length > 0 ? [{ keys, imageUrls }] : [];

  const childCandidates = Object.entries(record).flatMap(([key, child]) =>
    skuImageCandidatesFromUnknown(child, [...parentKeys, key, ...recordKeys], depth + 1)
  );

  return [...ownCandidate, ...childCandidates];
}

function variantMatchKeys(sku: string, mapKey: string, record: JsonRecord): string[] {
  const directKeys = variantKeysFromRecord(record);
  const comboKeys = [
    [record.colorPropName, record.sizePropName],
    [record.color, record.size],
    [record.colorName, record.sizeName],
    [record.specName, record.optionName]
  ]
    .map((items) => items.map(stringValue).filter(Boolean).join(""))
    .filter(Boolean);

  return uniqueStrings([sku, mapKey, ...directKeys, ...comboKeys].map(cleanVariantKey).filter(Boolean));
}

function variantKeysFromRecord(record: JsonRecord): string[] {
  const fields = [
    "itemNum",
    "sku",
    "skuId",
    "skuCode",
    "sellerSku",
    "sellerSkuId",
    "sourceSku",
    "asin",
    "variantId",
    "name",
    "skuName",
    "specName",
    "optionName",
    "propertyName",
    "propName",
    "colorPropName",
    "sizePropName",
    "colorName",
    "sizeName",
    "color",
    "size",
    "value",
    "valueName",
    "attrName",
    "attributeName"
  ];

  return uniqueStrings(fields.flatMap((field) => collectStringValues(record[field])));
}

function collectStringValues(value: unknown): string[] {
  const direct = stringValue(value);
  if (direct) return [direct];
  if (Array.isArray(value)) return value.flatMap(collectStringValues);
  if (value && typeof value === "object") return Object.values(value as JsonRecord).flatMap(collectStringValues);
  return [];
}

function cleanVariantKey(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function hasCommonVariantKey(leftKeys: string[], rightKeys: string[]): boolean {
  const left = uniqueStrings(leftKeys.map(cleanVariantKey).filter((key) => key.length >= 2));
  const right = uniqueStrings(rightKeys.map(cleanVariantKey).filter((key) => key.length >= 2));

  return left.some((leftKey) =>
    right.some((rightKey) => {
      if (leftKey === rightKey && leftKey.length >= 2) return true;
      if (leftKey.length < 4 || rightKey.length < 4) return false;
      return leftKey.includes(rightKey) || rightKey.includes(leftKey);
    })
  );
}

function firstSource(item: JsonRecord): JsonRecord | undefined {
  return Array.isArray(item.sourceList) ? asRecord(item.sourceList[0]) : undefined;
}

function parseIdList(value?: string): number[] {
  return (value ?? "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function firstTaskId(data: unknown): string | undefined {
  const record = asRecord(data);
  const ids = record.moveCollectTaskDetailIds;
  if (Array.isArray(ids) && ids.length > 0) return stringValue(ids[0]);
  return stringValue(record.taskId ?? record.id);
}
