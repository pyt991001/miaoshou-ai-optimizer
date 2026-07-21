import { NextRequest, NextResponse } from "next/server";
import { defaultImagePrompt, modelTryOnPrompt } from "@/lib/openai/image-rules";
import { readImageRuleConfig, saveImageRuleConfig, type StoredImageRuleProfile, type StoredImageRules } from "@/lib/openai/image-rule-config";
import { requireUser } from "@/lib/auth/session";
import { runWithAccountConfig } from "@/lib/config/account-runtime";

export async function GET() {
  const user = await requireUser();
  const config = await runWithAccountConfig(user.id, () => readImageRuleConfig());
  const rules = config.profiles.find((profile) => profile.id === config.activeProfileId) ?? config.profiles[0];
  return NextResponse.json({ rules, config, templates: { standard: defaultImagePrompt, model_try_on: modelTryOnPrompt } });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  return runWithAccountConfig(user.id, () => saveRules(request));
}

async function saveRules(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<StoredImageRules> & {
    activeProfileId?: string;
    profileId?: string;
    profileName?: string;
    description?: string;
  };
  const config = await readImageRuleConfig();
  const profileId = sanitizeId(body.profileId || body.activeProfileId || body.profileName || config.activeProfileId);
  const existing = config.profiles.find((profile) => profile.id === profileId);
  const profile: StoredImageRuleProfile = {
    ...(existing ?? {}),
    id: profileId,
    name: typeof body.profileName === "string" && body.profileName.trim() ? body.profileName.trim() : existing?.name ?? "未命名规则",
    description: typeof body.description === "string" ? body.description : existing?.description,
    quality: body.quality === "low" || body.quality === "medium" || body.quality === "high" ? body.quality : "high",
    size: body.size === "1024x1024" || body.size === "1536x1024" || body.size === "1024x1536" || body.size === "auto" ? body.size : "1024x1024",
    output_format: body.output_format === "jpeg" ? "jpeg" : "png",
    compression: typeof body.compression === "number" ? body.compression : undefined,
    background: body.background === "transparent" || body.background === "opaque" || body.background === "auto" ? body.background : "auto",
    number_of_variants: Math.min(Math.max(Number(body.number_of_variants ?? 1), 1), 4),
    image_prompt: typeof body.image_prompt === "string" ? body.image_prompt : undefined,
    template: body.template === "model_try_on" ? "model_try_on" : "standard",
    model_reference_image_url: typeof body.model_reference_image_url === "string" ? body.model_reference_image_url.trim() || undefined : undefined
  };
  const profiles = existing ? config.profiles.map((item) => (item.id === profileId ? profile : item)) : [...config.profiles, profile];
  const saved = await saveImageRuleConfig({ activeProfileId: profileId, profiles });
  return NextResponse.json({ ok: true, config: saved, rules: saved.profiles.find((item) => item.id === saved.activeProfileId) });
}

function sanitizeId(value: string): string {
  const id = value
    .toLowerCase()
    .replace(/[^a-z0-9_\u4e00-\u9fa5-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return id || `rule_${Date.now()}`;
}
