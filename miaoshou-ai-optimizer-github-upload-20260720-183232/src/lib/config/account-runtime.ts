import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secrets";

type Overrides = Record<string, string | undefined>;
type AccountRuntime = { userId: string; env: Overrides };
const storage = new AsyncLocalStorage<AccountRuntime>();

export function currentAccountEnv() {
  return storage.getStore()?.env ?? {};
}

export function currentAccountUserId() {
  return storage.getStore()?.userId ?? null;
}

export async function runWithAccountConfig<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const credentials = await prisma.apiCredential.findMany({ where: { userId, active: true }, orderBy: { updatedAt: "desc" } });
  const latest = new Map<string, Record<string, string>>();
  for (const credential of credentials) {
    if (!latest.has(credential.provider)) latest.set(credential.provider, decryptSecret<Record<string, string>>(credential.encryptedPayload));
  }
  const openai = latest.get("OPENAI") ?? {};
  const miaoshou = latest.get("MIAOSHOU") ?? {};
  const storageConfig = latest.get("STORAGE") ?? {};
  const overrides: Overrides = {
    OPENAI_API_KEY: openai.apiKey ?? "",
    OPENAI_BASE_URL: openai.baseUrl ?? "",
    OPENAI_TEXT_MODEL: openai.textModel || "gpt-5.5",
    OPENAI_IMAGE_API_KEY: openai.imageApiKey || openai.apiKey || "",
    OPENAI_IMAGE_BASE_URL: openai.imageBaseUrl || openai.baseUrl || "",
    OPENAI_IMAGE_MODEL: openai.imageModel || "gpt-image-2",
    MIAOSHOU_MODE: miaoshou.appKey && miaoshou.appSecret ? "real" : "mock",
    MIAOSHOU_API_BASE_URL: miaoshou.baseUrl ?? "",
    MIAOSHOU_APP_KEY: miaoshou.appKey ?? "",
    MIAOSHOU_APP_SECRET: miaoshou.appSecret ?? "",
    MIAOSHOU_ACCESS_TOKEN: miaoshou.accessToken ?? "",
    MIAOSHOU_REFRESH_TOKEN: miaoshou.refreshToken ?? "",
    MIAOSHOU_SHOP_ID: miaoshou.shopId ?? "",
    MIAOSHOU_TARGET_BOX: miaoshou.targetBox ?? "",
    MIAOSHOU_TARGET_PLATFORM: miaoshou.targetPlatform || "public",
    MIAOSHOU_TARGET_SITE: miaoshou.targetSite ?? "",
    STORAGE_DRIVER: storageConfig.accessKeyId && storageConfig.secretAccessKey ? "s3" : "local",
    S3_ENDPOINT: storageConfig.endpoint ?? "",
    S3_REGION: storageConfig.region || "auto",
    S3_BUCKET: storageConfig.bucket ?? "",
    S3_PUBLIC_BASE_URL: storageConfig.publicBaseUrl ?? "",
    S3_ACCESS_KEY_ID: storageConfig.accessKeyId ?? "",
    S3_SECRET_ACCESS_KEY: storageConfig.secretAccessKey ?? ""
  };
  return storage.run({ userId, env: overrides }, operation);
}
