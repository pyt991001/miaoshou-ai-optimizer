import OpenAI from "openai";
import { z } from "zod";
import { getEnv } from "@/lib/config/env";
import { retryWithBackoff } from "@/lib/utils/retry";

export const titleOptimizationSchema = z.object({
  originalTitle: z.string(),
  optimizedTitle: z.string().min(1),
  language: z.string(),
  characterCount: z.number().int().nonnegative(),
  keywords: z.array(z.string()),
  removedTerms: z.array(z.string()),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(100)
});

export type TitleOptimizationResult = z.infer<typeof titleOptimizationSchema> & {
  model: string;
  prompt: string;
  inputTokens: number;
  outputTokens: number;
  requestId?: string;
};

export interface TitleOptimizationInput {
  originalTitle: string;
  category?: string;
  attributes: Record<string, unknown>;
  material?: string;
  color?: string;
  size?: string;
  gender?: string;
  season?: string;
  targetCountry?: string;
  targetLanguage: string;
  targetPlatform: string;
  maxLength: number;
  forbiddenWords: string[];
  brandRule: string;
}

function buildPrompt(input: TitleOptimizationInput): string {
  return [
    "Optimize this cross-border e-commerce product title.",
    "Rules:",
    "Do not invent product attributes, material, brand, function or certification.",
    "Use only facts present in the product data.",
    "Keep important search terms, remove duplicate terms, shop names, promo words and irrelevant symbols.",
    "Follow the target platform word order and max character limit.",
    "Do not use unproven absolute claims such as Best, No.1 or Guaranteed.",
    "If brand is unclear, do not add a brand.",
    "For health products, do not add treatment, cure or disease prevention claims.",
    "Return strict JSON only with keys: originalTitle, optimizedTitle, language, characterCount, keywords, removedTerms, warnings, confidence.",
    "",
    `Original title: ${input.originalTitle}`,
    `Category: ${input.category ?? "unknown"}`,
    `Attributes: ${JSON.stringify(input.attributes)}`,
    `Material: ${input.material ?? "unknown"}`,
    `Color: ${input.color ?? "unknown"}`,
    `Size: ${input.size ?? "unknown"}`,
    `Gender: ${input.gender ?? "unknown"}`,
    `Season: ${input.season ?? "unknown"}`,
    `Target country: ${input.targetCountry ?? "unknown"}`,
    `Target language: ${input.targetLanguage}`,
    `Target platform: ${input.targetPlatform}`,
    `Max length: ${input.maxLength}`,
    `Forbidden words: ${input.forbiddenWords.join(", ") || "none"}`,
    `Brand rule: ${input.brandRule}`
  ].join("\n");
}

function parseStrictJson(raw: string) {
  return JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as unknown;
}

export async function optimizeTitle(input: TitleOptimizationInput): Promise<TitleOptimizationResult> {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) {
    return mockTitleOptimization(input, "OPENAI_API_KEY is not configured");
  }
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL || undefined });
  const prompt = buildPrompt(input);
  const model = env.OPENAI_TEXT_MODEL;

  const create = async (repairJson?: string) => {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a cautious e-commerce listing compliance editor. Return only valid JSON." },
        { role: "user", content: repairJson ? `${prompt}\n\nRepair this invalid JSON and return valid JSON only:\n${repairJson}` : prompt }
      ]
    });
    return response;
  };

  const response = await retryWithBackoff(() => create(), {
    attempts: 3,
    isRetryable: (error) => isOpenAIRetryable(error)
  }).catch((error) => {
    throw normalizeOpenAIError(error, model);
  });
  const raw = response.choices[0]?.message.content ?? "";
  let parsed = titleOptimizationSchema.safeParse(parseStrictJson(raw));
  if (!parsed.success) {
    const repaired = await create(raw);
    parsed = titleOptimizationSchema.safeParse(parseStrictJson(repaired.choices[0]?.message.content ?? ""));
  }
  if (!parsed.success) {
    throw new Error(`Title model returned invalid JSON: ${parsed.error.message}`);
  }

  return {
    ...parsed.data,
    model,
    prompt,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    requestId: response.id
  };
}

export function mockTitleOptimization(input: TitleOptimizationInput, reason?: string): TitleOptimizationResult {
  const forbidden = new Set(input.forbiddenWords.map((word) => word.toLowerCase()));
  const cleaned = input.originalTitle
    .split(/\s+/)
    .filter((term) => !forbidden.has(term.toLowerCase()))
    .filter((term) => !/promo|shop|guaranteed|best|no\.?1/i.test(term))
    .join(" ")
    .slice(0, input.maxLength);
  const optimizedTitle = cleaned || input.originalTitle.slice(0, input.maxLength);
  return {
    originalTitle: input.originalTitle,
    optimizedTitle,
    language: input.targetLanguage,
    characterCount: optimizedTitle.length,
    keywords: optimizedTitle.split(/\s+/).slice(0, 12),
    removedTerms: [],
    warnings: reason ? [reason, "Mock title optimization was used."] : ["Mock title optimization was used."],
    confidence: reason ? 70 : 82,
    model: "mock-title-optimizer",
    prompt: buildPrompt(input),
    inputTokens: 0,
    outputTokens: 0
  };
}

function isOpenAIRetryable(error: unknown): boolean {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
  return [408, 409, 429, 500, 502, 503, 504].includes(status);
}

function normalizeOpenAIError(error: unknown, model: string): Error {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 503 || /No available compatible accounts|没有可用的兼容账户/i.test(message)) {
    return new Error(`APIKL 当前没有可用的 ${model} 通道。请确认 APIKL 余额、模型权限，或把文字模型换成 APIKL 后台支持的模型。原始错误：${message}`);
  }
  return error instanceof Error ? error : new Error(message);
}
