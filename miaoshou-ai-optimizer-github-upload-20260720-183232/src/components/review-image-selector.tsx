"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredImageRuleConfig } from "@/lib/openai/image-rule-config";

type ReviewImage = {
  id: string;
  originalUrl: string;
  type: string;
  width?: number | null;
  height?: number | null;
  sortOrder?: number | null;
  optimizedUrl?: string | null;
};

type ReviewVariant = {
  id: string;
  sku: string;
  name?: string | null;
  color?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
};

type SkuImageRow = {
  id: string;
  label: string;
  subLabel: string;
  images: ReviewImage[];
};

export function ReviewImageSelector({ productId, images, variants = [] }: { productId: string; images: ReviewImage[]; variants?: ReviewVariant[] }) {
  const storageKey = useMemo(() => `miaoshou:selected-images:${productId}`, [productId]);
  const ruleStorageKey = useMemo(() => `miaoshou:selected-image-rule:${productId}`, [productId]);
  const defaultSelected = useMemo(() => (images[0] ? [images[0].id] : []), [images]);
  const rows = useMemo(() => buildSkuRows(images, variants), [images, variants]);
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
  const selectFirstPerSku = () => {
    const skuRows = rows.filter((row) => row.id !== "product-common-images");
    const sourceRows = skuRows.length > 0 ? skuRows : rows;
    const firstImageIds = sourceRows
      .map((row) => row.images[0]?.id)
      .filter((id): id is string => Boolean(id));
    setSelected(new Set(firstImageIds.length > 0 ? firstImageIds : defaultSelected));
  };
  const selectAll = () => setSelected(new Set(images.map((image) => image.id)));

  return (
    <div className="rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div>
          <div className="text-lg font-semibold">SKU 图片</div>
          <div className="mt-1 text-xs text-slate-500">已选 {selected.size || 0} 张；鼠标放到已洗图片上可直接看洗图结果。</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
        {ruleConfig ? (
          <select className="rounded-md border border-line bg-white px-3 py-2 text-sm" value={ruleProfileId || ruleConfig.activeProfileId} onChange={(event) => setRuleProfileId(event.target.value)}>
            {ruleConfig.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        ) : null}
        <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" type="button" onClick={selectFirst}>
          只选第一张
        </button>
        <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" type="button" onClick={selectFirstPerSku}>
          每个 SKU 第一张
        </button>
        <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" type="button" onClick={selectAll}>
          全选图片
        </button>
        </div>
      </div>
      <div className="grid grid-cols-[145px_1fr] bg-slate-50 text-sm font-semibold text-slate-500">
        <div className="px-3 py-2">SKU选项</div>
        <div className="px-3 py-2">图片</div>
      </div>
      <div className="max-h-[560px] divide-y divide-line overflow-y-auto">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[145px_1fr] bg-white">
            <div className="px-3 py-3">
              <div className="break-all font-medium text-slate-700">{row.label}</div>
              <div className="mt-1 max-h-8 overflow-hidden text-xs text-slate-500" title={row.subLabel}>{row.subLabel}</div>
              <button
                className="mt-2 text-sm text-accent"
                type="button"
                onClick={() => {
                  const ids = row.images.map((image) => image.id);
                  setSelected((current) => {
                    const next = new Set(current);
                    const allChecked = ids.length > 0 && ids.every((id) => next.has(id));
                    ids.forEach((id) => {
                      if (allChecked) next.delete(id);
                      else next.add(id);
                    });
                    return next;
                  });
                }}
              >
                {row.images.length > 0 && row.images.every((image) => selected.has(image.id)) ? "取消本组" : "全选本组"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2.5 px-3 py-3">
              {row.images.length > 0 ? (
                row.images.map((image) => (
                  <ImageCard key={image.id} image={image} checked={selected.has(image.id)} onToggle={() => toggleOne(image.id)} />
                ))
              ) : (
                <div className="grid h-[150px] w-[150px] place-items-center rounded-md border border-dashed border-line bg-cloud text-sm text-slate-400">这个 SKU 暂无图片</div>
              )}
              <div className="grid h-[150px] w-[150px] place-items-center rounded-md border border-line bg-slate-50 text-4xl text-slate-300">+</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageCard({ image, checked, onToggle }: { image: ReviewImage; checked: boolean; onToggle: () => void }) {
  const sizeLabel = image.width && image.height ? `${image.width} × ${image.height}` : "尺寸未知";
  return (
    <label className={`group relative h-[150px] w-[150px] cursor-pointer rounded-md border bg-white ${checked ? "border-accent ring-2 ring-accent/20" : "border-line"}`}>
      <div className="absolute left-0 top-0 z-10 h-0 w-0 border-l-[22px] border-t-[22px] border-l-accent border-t-accent" />
      <div className="relative h-[100px] overflow-hidden rounded-t-md bg-slate-50">
        <img src={image.originalUrl} alt="" referrerPolicy="no-referrer" className={`h-full w-full object-cover transition-opacity ${image.optimizedUrl ? "group-hover:opacity-0" : ""}`} />
        {image.optimizedUrl ? (
          <>
            <img src={image.optimizedUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute left-1.5 top-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white opacity-0 shadow group-hover:opacity-100">洗图后</div>
          </>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-line px-2 py-1 text-xs text-slate-600">
        <span>{sizeLabel}</span>
        <span className="inline-flex items-center gap-1">
          <input checked={checked} type="checkbox" onChange={onToggle} />
          洗
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-0.5 text-[11px] text-slate-500">
        <span className="truncate">{image.type}</span>
        {image.optimizedUrl ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">已洗</span> : <span />}
      </div>
    </label>
  );
}

function buildSkuRows(images: ReviewImage[], variants: ReviewVariant[]): SkuImageRow[] {
  const usedImageIds = new Set<string>();
  const imageByUrl = new Map(images.map((image) => [normalizeUrl(image.originalUrl), image]));
  const rows: SkuImageRow[] = variants.map((variant, index) => {
    const variantUrls = [...(variant.imageUrls ?? []), variant.imageUrl].filter(Boolean) as string[];
    const rowImages = uniqueImages(variantUrls.map((url) => imageByUrl.get(normalizeUrl(url))).filter((image): image is ReviewImage => Boolean(image)));
    rowImages.forEach((image) => usedImageIds.add(image.id));
    return {
      id: variant.id,
      label: variant.sku || `SKU-${index + 1}`,
      subLabel: [variant.name, variant.color, variant.size].filter(Boolean).join(" / ") || `第 ${index + 1} 个 SKU`,
      images: rowImages
    };
  });
  const unassigned = images.filter((image) => !usedImageIds.has(image.id));
  if (unassigned.length > 0 || rows.length === 0) {
    rows.unshift({
      id: "product-common-images",
      label: "商品通用图",
      subLabel: "主图 / 轮播图 / 详情图",
      images: unassigned.length > 0 ? unassigned : images
    });
  }
  return rows;
}

function normalizeUrl(url?: string | null) {
  return (url ?? "").trim().replace(/^http:\/\//, "https://").replace(/\?.*$/, "");
}

function uniqueImages(images: ReviewImage[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.id)) return false;
    seen.add(image.id);
    return true;
  });
}
