"use client";

import { useMemo, useState } from "react";
import { defaultImagePrompt, modelTryOnPrompt } from "@/lib/openai/image-rules";
import type { StoredImageRuleConfig, StoredImageRuleProfile } from "@/lib/openai/image-rule-config";

type EditableProfile = StoredImageRuleProfile;

export function ImageRulesForm({ initialConfig }: { initialConfig: StoredImageRuleConfig }) {
  const [profiles, setProfiles] = useState<EditableProfile[]>(initialConfig.profiles);
  const [activeProfileId, setActiveProfileId] = useState(initialConfig.activeProfileId);
  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0], [activeProfileId, profiles]);
  const [draft, setDraft] = useState<EditableProfile>(activeProfile);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectProfile = (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    setActiveProfileId(profile.id);
    setDraft(profile);
    setMessage(null);
  };

  const changeTemplate = (next: "standard" | "model_try_on") => {
    setDraft((current) => ({
      ...current,
      template: next,
      image_prompt: next === "model_try_on" ? modelTryOnPrompt : defaultImagePrompt
    }));
  };

  const createProfile = () => {
    const name = `新规则 ${profiles.length + 1}`;
    const profile: EditableProfile = {
      id: `rule_${Date.now()}`,
      name,
      description: "给一个类目单独使用的洗图规则",
      quality: "high",
      size: "1024x1024",
      output_format: "png",
      number_of_variants: 1,
      background: "auto",
      template: "standard",
      image_prompt: defaultImagePrompt
    };
    setProfiles((current) => [...current, profile]);
    setActiveProfileId(profile.id);
    setDraft(profile);
  };

  const save = async () => {
    setSaving(true);
    setMessage("正在保存图片规则...");
    try {
      const response = await fetch("/api/rules/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          activeProfileId: draft.id,
          profileId: draft.id,
          profileName: draft.name,
          description: draft.description,
          template: draft.template,
          image_prompt: draft.image_prompt,
          quality: draft.quality,
          size: draft.size,
          output_format: draft.output_format,
          number_of_variants: Number(draft.number_of_variants),
          background: draft.background ?? "auto",
          model_reference_image_url: draft.model_reference_image_url
        })
      });
      const data = (await response.json().catch(() => ({}))) as { config?: StoredImageRuleConfig; rules?: StoredImageRuleProfile; message?: string };
      if (!response.ok || !data.config) throw new Error(data.message ?? "保存失败");
      setProfiles(data.config.profiles);
      setActiveProfileId(data.config.activeProfileId);
      setDraft(data.rules ?? draft);
      setMessage("保存成功。洗图时可以在商品详情页选择这套规则。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">规则库</h2>
          <button className="rounded-md border border-line bg-white px-2 py-1 text-xs" type="button" onClick={createProfile}>
            新增
          </button>
        </div>
        <div className="space-y-2">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              className={`w-full rounded-md border p-3 text-left text-sm ${profile.id === draft.id ? "border-accent bg-emerald-50" : "border-line bg-white"}`}
              type="button"
              onClick={() => selectProfile(profile.id)}
            >
              <div className="font-medium">{profile.name}</div>
              <div className="mt-1 line-clamp-2 text-xs text-slate-500">{profile.description ?? "无说明"}</div>
            </button>
          ))}
        </div>
      </aside>

      <div className="panel grid gap-3 p-5">
        <label className="grid gap-1 text-sm">
          规则名称
          <input className="rounded-md border border-line px-3 py-2" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">
          适用说明
          <input className="rounded-md border border-line px-3 py-2" value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">
          洗图模板
          <select className="rounded-md border border-line px-3 py-2" value={draft.template ?? "standard"} onChange={(event) => changeTemplate(event.target.value as "standard" | "model_try_on")}>
            <option value="standard">普通商品图优化</option>
            <option value="model_try_on">换装到我的模特身上</option>
          </select>
        </label>
        {draft.template === "model_try_on" ? (
          <label className="grid gap-1 text-sm">
            我的模特参考图链接
            <input className="rounded-md border border-line px-3 py-2" placeholder="例如 https://img.kkkkcccc.xyz/model/my-model.png" value={draft.model_reference_image_url ?? ""} onChange={(event) => setDraft({ ...draft, model_reference_image_url: event.target.value })} />
            <span className="text-xs text-slate-500">这套规则单独保存模特图链接，不会影响其他类目规则。</span>
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">
          提示词
          <textarea className="min-h-52 rounded-md border border-line px-3 py-2" value={draft.image_prompt ?? ""} onChange={(event) => setDraft({ ...draft, image_prompt: event.target.value })} />
        </label>
        <div className="grid grid-cols-4 gap-3">
          <select className="rounded-md border border-line px-3 py-2" value={draft.quality ?? "high"} onChange={(event) => setDraft({ ...draft, quality: event.target.value as "low" | "medium" | "high" })}>
            <option>high</option>
            <option>medium</option>
            <option>low</option>
          </select>
          <select className="rounded-md border border-line px-3 py-2" value={draft.size ?? "1024x1024"} onChange={(event) => setDraft({ ...draft, size: event.target.value as "1024x1024" | "1536x1024" | "1024x1536" | "auto" })}>
            <option>1024x1024</option>
            <option>1536x1024</option>
            <option>1024x1536</option>
            <option>auto</option>
          </select>
          <select className="rounded-md border border-line px-3 py-2" value={draft.output_format ?? "png"} onChange={(event) => setDraft({ ...draft, output_format: event.target.value as "png" | "jpeg" })}>
            <option>png</option>
            <option>jpeg</option>
          </select>
          <input className="rounded-md border border-line px-3 py-2" value={draft.number_of_variants ?? 1} type="number" min="1" max="4" onChange={(event) => setDraft({ ...draft, number_of_variants: Number(event.target.value) })} />
        </div>
        <button className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white disabled:opacity-60" disabled={saving} onClick={save}>
          {saving ? "保存中" : "保存这套规则"}
        </button>
        {message ? <div className="text-sm text-slate-600">{message}</div> : null}
      </div>
    </div>
  );
}
