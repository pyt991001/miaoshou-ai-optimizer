import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { getEnv } from "@/lib/config/env";
import { getStorageDriver } from "@/lib/files/storage";
import { readImageRules } from "@/lib/openai/image-rule-config";
import { buildImagePrompt, defaultRules, type ImageOptimizationRules } from "@/lib/openai/image-rules";
import { validateOptimizedImage, type ImageValidationResult } from "@/lib/openai/image-validator";
import { retryWithBackoff } from "@/lib/utils/retry";
import type { ProductImageType } from "@prisma/client";

export interface ImageOptimizationInput {
  originalPath: string;
  title: string;
  category?: string;
  imageType: ProductImageType;
  ruleProfileId?: string;
  rules?: Partial<ImageOptimizationRules>;
}

export interface ImageOptimizationResult {
  optimizedUrl: string;
  optimizedPath: string;
  model: string;
  prompt: string;
  requestId?: string;
  processingMs: number;
  validation: ImageValidationResult;
  costUsd: number;
}

export async function optimizeProductImage(input: ImageOptimizationInput): Promise<ImageOptimizationResult> {
  const env = getEnv();
  const storedRules = await readImageRules(input.imageType, input.ruleProfileId);
  const rules = { ...defaultRules(input.imageType), ...storedRules, ...input.rules, image_type: input.imageType };
  const prompt = buildImagePrompt({ title: input.title, category: input.category, imageType: input.imageType, rules });
  const started = Date.now();
  let buffer: Buffer | undefined;
  let requestId: string | undefined;

  const imageApiKey = env.OPENAI_IMAGE_API_KEY || env.OPENAI_API_KEY;
  const imageBaseUrl = env.OPENAI_IMAGE_BASE_URL || env.OPENAI_BASE_URL;

  if (!imageApiKey) {
    buffer = await mockImageEdit(input.originalPath, rules.output_format);
  } else {
    // Disable the SDK's hidden retries. This call already has explicit retry control below;
    // stacking both layers can multiply one image into many billable requests.
    const client = new OpenAI({ apiKey: imageApiKey, baseURL: imageBaseUrl || undefined, maxRetries: 0 });
    const modelReferencePath = rules.model_reference_image_url ? await downloadReferenceImage(rules.model_reference_image_url) : null;
    const imageInputPath = modelReferencePath && rules.template === "model_try_on" ? await buildTryOnReferenceSheet(input.originalPath, modelReferencePath) : input.originalPath;
    const imageFile = await imagePathToPngFile(imageInputPath);

    let apiAttempt = 0;
    for (let visualAttempt = 0; visualAttempt < 2; visualAttempt += 1) {
      const attemptPrompt =
        visualAttempt === 0
          ? prompt
          : `${prompt}\nIMPORTANT RETRY: The previous output was visually unchanged. Apply the requested transformation clearly and visibly while preserving the garment design.`;
      const response = await retryWithBackoff(
        () => {
          apiAttempt += 1;
          console.info("[image-generation] API attempt", { visualAttempt: visualAttempt + 1, apiAttempt });
          return client.images.edit({
            model: env.OPENAI_IMAGE_MODEL,
            image: imageFile,
            prompt: attemptPrompt,
            size: rules.size,
            quality: rules.quality,
            n: rules.number_of_variants,
            background: rules.background,
            output_format: rules.output_format,
            ...(rules.output_format === "png" ? {} : { output_compression: rules.compression })
          } as never);
        },
        {
          attempts: 2,
          isRetryable: (error) => {
            const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
            return [408, 409, 429, 500, 502, 503, 504].includes(status);
          }
        }
      ).catch((error) => {
        throw normalizeOpenAIImageError(error, env.OPENAI_IMAGE_MODEL);
      });

      requestId = "id" in response ? String(response.id) : undefined;
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("GPT Image API returned an empty image result");
      const candidate = Buffer.from(b64, "base64");
      const unchanged = await isVisuallyUnchanged(input.originalPath, candidate);
      if (!unchanged) {
        buffer = candidate;
        break;
      }
    }
  }

  if (!buffer) throw new Error("图片 AI 连续两次返回与原图几乎相同的结果，本次未标记为已洗，请重试或更换洗图规则。");

  const validation = await validateOptimizedImage({
    originalPath: input.originalPath,
    optimizedBuffer: buffer,
    expectedFormat: rules.output_format,
    title: input.title
  });

  const key = `optimized/${Date.now()}-${randomUUID()}-${path.basename(input.originalPath).replace(/\.[^.]+$/, "")}.${rules.output_format}`;
  const stored = await getStorageDriver().put(buffer, key, `image/${rules.output_format}`);

  return {
    optimizedUrl: stored.url,
    optimizedPath: stored.path,
    model: env.OPENAI_IMAGE_MODEL,
    prompt,
    requestId,
    processingMs: Date.now() - started,
    validation,
    costUsd: 0
  };
}

async function isVisuallyUnchanged(originalPath: string, optimizedBuffer: Buffer): Promise<boolean> {
  const [originalPixels, optimizedPixels] = await Promise.all([
    sharp(originalPath).resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer(),
    sharp(optimizedBuffer).resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer()
  ]);
  if (originalPixels.length !== optimizedPixels.length || originalPixels.length === 0) return false;
  let totalDifference = 0;
  for (let index = 0; index < originalPixels.length; index += 1) {
    totalDifference += Math.abs(originalPixels[index] - optimizedPixels[index]);
  }
  return totalDifference / originalPixels.length / 255 < 0.012;
}

async function mockImageEdit(filePath: string, format: "png" | "jpeg"): Promise<Buffer> {
  return sharp(filePath)
    .resize(1024, 1024, { fit: "contain", background: { r: 248, g: 249, b: 250, alpha: 1 } })
    .sharpen()
    .toFormat(format, { quality: 88 })
    .toBuffer();
}

async function downloadReferenceImage(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`模特参考图下载失败：${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const dir = path.join(process.cwd(), "storage", "tmp", "model-references");
  await fs.promises.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${Date.now()}-model.png`);
  await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
  return filePath;
}

async function imagePathToPngFile(imagePath: string) {
  const pngBuffer = await sharp(imagePath).png().toBuffer();
  return toFile(pngBuffer, "input.png", { type: "image/png" });
}

async function buildTryOnReferenceSheet(garmentPath: string, modelPath: string): Promise<string> {
  const dir = path.join(process.cwd(), "storage", "tmp", "try-on-references");
  await fs.promises.mkdir(dir, { recursive: true });

  const outputPath = path.join(dir, `${Date.now()}-try-on-reference.png`);
  const garment = await sharp(garmentPath).resize(900, 900, { fit: "inside", background: "#ffffff" }).png().toBuffer();
  const model = await sharp(modelPath).resize(900, 900, { fit: "inside", background: "#ffffff" }).png().toBuffer();

  const labelSvg = `
    <svg width="2000" height="1160" xmlns="http://www.w3.org/2000/svg">
      <rect width="2000" height="1160" fill="#ffffff"/>
      <rect x="40" y="40" width="920" height="1080" fill="#f8fafc" stroke="#0f766e" stroke-width="6"/>
      <rect x="1040" y="40" width="920" height="1080" fill="#f8fafc" stroke="#334155" stroke-width="6"/>
      <text x="80" y="105" font-size="44" font-family="Arial, sans-serif" font-weight="700" fill="#0f766e">IMAGE 1: GARMENT SOURCE</text>
      <text x="80" y="160" font-size="28" font-family="Arial, sans-serif" fill="#0f766e">Copy this clothing exactly. Keep print/design/color.</text>
      <text x="1080" y="105" font-size="44" font-family="Arial, sans-serif" font-weight="700" fill="#334155">IMAGE 2: MODEL REFERENCE ONLY</text>
      <text x="1080" y="160" font-size="28" font-family="Arial, sans-serif" fill="#334155">Use person/pose. Ignore this clothing print/text.</text>
    </svg>`;

  await sharp(Buffer.from(labelSvg))
    .composite([
      { input: garment, left: 50, top: 205 },
      { input: model, left: 1050, top: 205 }
    ])
    .png()
    .toFile(outputPath);

  return outputPath;
}

function normalizeOpenAIImageError(error: unknown, model: string): Error {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 524 || /524 status code|status code \(no body\)/i.test(message)) {
    return new Error(`图片 AI 中转站超时（524）。这通常是 APIKL/中转站图片通道太慢或暂时不可用；请稍后重试，或换图片模型/通道。原始错误：${message}`);
  }

  if (status === 503 || /No available compatible accounts|没有可用的兼容账户/i.test(message)) {
    return new Error(`APIKL 当前没有可用的 ${model} 图片通道。请确认 APIKL 是否支持图片生成/编辑模型、账号余额和模型权限。原始错误：${message}`);
  }

  if (/connection error|fetch failed|network|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(message)) {
    return new Error(
      `图片 AI 连接失败。请检查 OpenAI/APIKL 配置：OPENAI_IMAGE_BASE_URL 必须是中转站接口地址并带 /v1，OPENAI_IMAGE_API_KEY 或 OPENAI_API_KEY 必须可用，OPENAI_IMAGE_MODEL 必须是该中转站支持的图片模型。原始错误：${message}`
    );
  }

  return error instanceof Error ? error : new Error(message);
}
