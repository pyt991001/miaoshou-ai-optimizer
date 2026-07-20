"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredImageRuleConfig } from "@/lib/openai/image-rule-config";

type ReviewImage = {
  id: string;
  originalUrl: string;
  type: string;
};

export function ReviewImageSelector({ productId, images }: { productId: string; images: ReviewImage[] }) {
  const storageKey = useMemo(() => `miaoshou:selected-images:${productId}`, [productId]);
  const ruleStorageKey = useMemo(() => `miaoshou:selected-image-rule:${productId}`, [productId]);
  const defaultSelected = useMemo(() => (images[0] ? [images[0].id] : []), [images]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected));
  const [ruleConfig, setRuleConfig] = useState<StoredImageRuleConfig | null>(null);
  const [ruleProfileId, setRuleProfileId] = useState<string>("");

  useEffect(() => {
    fetch("/api/rules/images")
      .then((response) => response.json())
      .then((data: { config?: StoredImageRuleConfig }) => {
        if (!data.config) return;
        setRuleConfig(data.config);
        setRuleProfileId(window.localStorage.getItem(ruleStorageKey) || data.config.activeProfileId);
      })
      .catch(() => null);
  }, [ruleStorageKey]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const savedIds = saved ? (JSON.parse(saved) as string[]) : defaultSelected;
    const validIds = new Set(images.map((image) => image.id));
    const next = savedIds.filter((id) => validIds.has(id));
    setSelected(new Set(next.length > 0 ? next : defaultSelected));
  }, [defaultSelected, images, storageKey]);

  useEffect(() => {
    const ids = [...selected];
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent("miaoshou-image-selection-change", { detail: { productId, imageIds: ids } }));
  }, [productId, selected, storageKey]);

  useEffect(() => {
    if (!ruleProfileId) return;
    window.localStorage.setItem(ruleStorageKey, ruleProfileId);
  }, [ruleProfileId, ruleStorageKey]);

  const toggleOne = (imageId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  };

  const selectFirst = () => setSelected(new Set(defaultSelected));
  const selectAll = () => setSelected(new Set(images.map((image) => image.id)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">已选择洗图 {selected.size || 0} 张</span>
        {ruleConfig ? (
          <select className="rounded border border-line bg-white px-2 py-1" value={ruleProfileId || ruleConfig.activeProfileId} onChange={(event) => setRuleProfileId(event.target.value)}>
            {ruleConfig.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        ) : null}
        <button className="rounded border border-line bg-white px-2 py-1" type="button" onClick={selectFirst}>
          只选第一张
        </button>
        <button className="rounded border border-line bg-white px-2 py-1" type="button" onClick={selectAll}>
          全选图片
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {images.map((image, index) => {
          const checked = selected.has(image.id);
          return (
            <label key={image.id} className={`relative cursor-pointer rounded-md border p-2 ${checked ? "border-accent ring-2 ring-accent/20" : "border-line"}`}>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                <span>{index === 0 ? "原图 / 默认洗" : "原图"}</span>
                <span className="inline-flex items-center gap-1">
                  <input checked={checked} type="checkbox" onChange={() => toggleOne(image.id)} />
                  洗这张
                </span>
              </div>
              <img src={image.originalUrl} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded object-cover" />
              <div className="mt-2 text-xs text-slate-500">{image.type}</div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
