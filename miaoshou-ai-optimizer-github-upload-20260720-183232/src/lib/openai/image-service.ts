import fs from "node:fs/promises";
import path from "node:path";
import { defaultImagePrompt, defaultRules, modelTryOnPrompt, type ImageOptimizationRules } from "@/lib/openai/image-rules";
import type { ProductImageType } from "@prisma/client";

export type StoredImageRules = Omit<ImageOptimizationRules, "image_type">;
export type StoredImageRuleProfile = StoredImageRules & {
  id: string;
  name: string;
  description?: string;
};

export type StoredImageRuleConfig = {
  activeProfileId: string;
  profiles: StoredImageRuleProfile[];
};

const configFile = path.join(process.cwd(), "storage", "image-rules.json");

export const defaultImageRuleProfiles: StoredImageRuleProfile[] = [
  {
    id: "tshirt_model",
    name: "T恤/服装模特图",
    description: "把衣服换到固定模特身上，适合 T 恤、卫衣、裙子等。",
    quality: "high",
    size: "1024x1024",
    output_format: "png",
    background: "auto",
    number_of_variants: 1,
    template: "model_try_on",
    image_prompt: modelTryOnPrompt
  },
  {
    id: "clean_product",
    name: "普通商品白底优化",
    description: "保留商品本体，清理背景，适合非服装商品。",
    quality: "high",
    size: "1024x1024",
    output_format: "png",
    background: "auto",
    number_of_variants: 1,
    template: "standard",
    image_prompt: defaultImagePrompt
  },
  {
    id: "accessory_detail",
    name: "饰品/小物细节图",
    description: "强调材质、细节、光泽，不改造产品形状。",
    quality: "high",
    size: "1024x1024",
    output_format: "png",
    background: "auto",
    number_of_variants: 1,
    template: "standard",
    image_prompt:
      "Edit this product image into a premium e-commerce close-up. Preserve the exact item shape, material, color, pattern, stones, metal finish, engravings and all small details. Improve lighting, sharpness and realistic reflections. Use a clean commercial background. Do not change the product design, do not add extra accessories, text, logos, hands or props unless already present."
  },
  {
    id: "home_lifestyle",
    name: "家居/生活场景图",
    description: "适合家居百货，轻场景化但不虚构功能。",
    quality: "high",
    size: "1024x1024",
    output_format: "png",
    background: "auto",
    number_of_variants: 1,
    template: "standard",
    image_prompt:
      "Edit this product image into a realistic lifestyle e-commerce image. Preserve the exact product design, material, color, proportions and included items. Place it in a clean, tasteful home or daily-use setting with natural lighting and realistic shadows. Do not invent new functions, parts, text, packaging claims, logos or accessories."
  }
];

export async function readStoredImageRules(): Promise<Partial<StoredImageRules>> {
  const config = await readImageRuleConfig();
  return config.profiles.find((profile) => profile.id === config.activeProfileId) ?? config.profiles[0] ?? {};
}

export async function readImageRuleConfig(): Promise<StoredImageRuleConfig> {
  try {
    const raw = await fs.readFile(configFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredImageRuleConfig> & Partial<StoredImageRules>;
    if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
      const profiles = mergeDefaultProfiles(parsed.profiles);
      const activeProfileId = profiles.some((profile) => profile.id === parsed.activeProfileId) ? String(parsed.activeProfileId) : profiles[0].id;
      return { activeProfileId, profiles };
    }
    const legacyProfile = cleanProfile({
      ...parsed,
      id: "custom_legacy",
      name: "我的旧规则"
    });
    return {
      activeProfileId: legacyProfile.id,
      profiles: mergeDefaultProfiles([legacyProfile])
    };
  } catch {
    return { activeProfileId: defaultImageRuleProfiles[0].id, profiles: defaultImageRuleProfiles };
  }
}

export async function readImageRules(imageType: ProductImageType, profileId?: string): Promise<ImageOptimizationRules> {
  const config = await readImageRuleConfig();
  const stored = config.profiles.find((profile) => profile.id === profileId) ?? config.profiles.find((profile) => profile.id === config.activeProfileId) ?? config.profiles[0];
  return { ...defaultRules(imageType), ...stored, image_type: imageType };
}

export async function saveStoredImageRules(rules: Partial<StoredImageRules>): Promise<Partial<StoredImageRules>> {
  const config = await readImageRuleConfig();
  const active = config.profiles.find((profile) => profile.id === config.activeProfileId) ?? config.profiles[0];
  const profile = cleanProfile({ ...active, ...rules, id: active.id, name: active.name });
  const next = {
    activeProfileId: profile.id,
    profiles: config.profiles.map((item) => (item.id === profile.id ? profile : item))
  };
  await fs.mkdir(path.dirname(configFile), { recursive: true });
  await fs.writeFile(configFile, JSON.stringify(next, null, 2));
  return profile;
}

export async function saveImageRuleConfig(config: StoredImageRuleConfig): Promise<StoredImageRuleConfig> {
  const profiles = mergeDefaultProfiles(config.profiles.map(cleanProfile));
  const activeProfileId = profiles.some((profile) => profile.id === config.activeProfileId) ? config.activeProfileId : profiles[0].id;
  const next = { activeProfileId, profiles };
  await fs.mkdir(path.dirname(configFile), { recursive: true });
  await fs.writeFile(configFile, JSON.stringify(next, null, 2));
  return next;
}

function cleanProfile(profile: Partial<StoredImageRuleProfile> & { id?: string; name?: string }): StoredImageRuleProfile {
  const template = profile.template === "model_try_on" ? "model_try_on" : "standard";
  return {
    id: sanitizeId(profile.id || profile.name || `rule_${Date.now()}`),
    name: String(profile.name || "未命名规则"),
    description: typeof profile.description === "string" ? profile.description : undefined,
    quality: profile.quality === "low" || profile.quality === "medium" || profile.quality === "high" ? profile.quality : "high",
    size: profile.size === "1024x1024" || profile.size === "1536x1024" || profile.size === "1024x1536" || profile.size === "auto" ? profile.size : "1024x1024",
    output_format: profile.output_format === "jpeg" ? "jpeg" : "png",
    compression: typeof profile.compression === "number" ? profile.compression : undefined,
    background: profile.background === "transparent" || profile.background === "opaque" || profile.background === "auto" ? profile.background : "auto",
    number_of_variants: Math.min(Math.max(Number(profile.number_of_variants ?? 1), 1), 4),
    image_prompt: typeof profile.image_prompt === "string" ? profile.image_prompt : template === "model_try_on" ? modelTryOnPrompt : defaultImagePrompt,
    template,
    model_reference_image_url: typeof profile.model_reference_image_url === "string" ? profile.model_reference_image_url.trim() || undefined : undefined
  };
}

function mergeDefaultProfiles(profiles: StoredImageRuleProfile[]): StoredImageRuleProfile[] {
  const map = new Map<string, StoredImageRuleProfile>();
  for (const profile of defaultImageRuleProfiles) map.set(profile.id, profile);
  for (const profile of profiles) map.set(profile.id, profile);
  return [...map.values()];
}

function sanitizeId(value: string): string {
  const id = value
    .toLowerCase()
    .replace(/[^a-z0-9_\u4e00-\u9fa5-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return id || `rule_${Date.now()}`;
}
