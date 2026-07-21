import { z } from "zod";
import { currentAccountEnv } from "@/lib/config/account-runtime";

const envBoolean = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return value;
  }, z.boolean());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  APP_ENCRYPTION_KEY: z.string().min(16).default("dev-only-change-this-key-32-bytes"),
  APP_SESSION_SECRET: z.string().min(32).default("dev-only-session-secret-change-me-32"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
  APP_PASSWORD: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional()),
  OPENAI_TEXT_MODEL: z.string().default("gpt-5.5"),
  OPENAI_IMAGE_API_KEY: z.string().optional(),
  OPENAI_IMAGE_BASE_URL: z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional()),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
  ENABLE_IMAGE_VISION_VALIDATION: envBoolean(false),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional()),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: envBoolean(true),
  MIAOSHOU_MODE: z.enum(["mock", "real"]).default("mock"),
  MIAOSHOU_API_BASE_URL: z.string().optional(),
  MIAOSHOU_APP_KEY: z.string().optional(),
  MIAOSHOU_APP_SECRET: z.string().optional(),
  MIAOSHOU_ACCESS_TOKEN: z.string().optional(),
  MIAOSHOU_REFRESH_TOKEN: z.string().optional(),
  MIAOSHOU_SHOP_ID: z.string().optional(),
  MIAOSHOU_TARGET_BOX: z.string().optional(),
  MIAOSHOU_TARGET_PLATFORM: z.enum(["public", "shopee", "tiktok", "shein"]).default("public"),
  MIAOSHOU_TARGET_SITE: z.string().optional(),
  OPENAI_DAILY_COST_LIMIT: z.coerce.number().default(50),
  OPENAI_TASK_COST_LIMIT: z.coerce.number().default(10),
  OPENAI_CONCURRENCY: z.coerce.number().min(1).max(10).default(2),
  MIAOSHOU_CONCURRENCY: z.coerce.number().min(1).max(10).default(2),
  MAX_PRODUCTS_PER_TASK: z.coerce.number().min(1).max(500).default(500),
  MAX_IMAGES_PER_PRODUCT: z.coerce.number().min(1).max(50).default(12)
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  const account = currentAccountEnv();
  const merged = { ...process.env } as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(account)) if (value !== undefined) merged[key] = value;
  return envSchema.parse(merged);
}
