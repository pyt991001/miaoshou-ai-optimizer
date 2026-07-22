"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { StoredImageRuleConfig } from "@/lib/openai/image-rule-config";

type ProductRow = {
  id: string;
  miaoshouProductId: string;
  mainImageUrl: string | null;
  optimizedMainImageUrl: string | null;
  originalTitle: string;
  optimizedTitle: string | null;
  status: string;
  source: string;
  targetPlatform: string;
  imageCount: number;
  skuCount: number;
  skuList?: Array<{
    sku: string;
    name: string | null;
    color: string | null;
    size: string | null;
    imageUrl: string | null;
    imageId: string | null;
    originalImageUrl: string | null;
    optimizedImageUrl: string | null;
    optimizedImageCount: number;
  }>;
  processingStatus: string;
  updatedAt: string;
};

type BatchAction = "title" | "image" | "save";

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<BatchAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ruleConfig, setRuleConfig] = useState<StoredImageRuleConfig | null>(null);
  const [batchRuleProfileId, setBatchRuleProfileId] = useState<string>("");
  const [batchConcurrency, setBatchConcurrency] = useState(1);
  const [selectedSkuImages, setSelectedSkuImages] = useState<Record<string, Set<string>>>({});
  const [hoverPreview, setHoverPreview] = useState<{ sku: string; originalUrl: string; optimizedUrl: string | null; top: number; left: number } | null>(null);

  const selectedProducts = useMemo(() => products.filter((product) => selected.has(product.id)), [products, selected]);
  const allSelected = products.length > 0 && selected.size === products.length;

  useEffect(() => {
    fetch("/api/rules/images")
      .then((response) => response.json())
      .then((data: { config?: StoredImageRuleConfig }) => {
        if (!data.config) return;
        setRuleConfig(data.config);
        setBatchRuleProfileId(window.localStorage.getItem("miaoshou:batch-image-rule") || data.config.activeProfileId);
        const savedConcurrency = Number(window.localStorage.getItem("miaoshou:batch-image-concurrency") || 1);
        setBatchConcurrency(Math.min(Math.max(savedConcurrency || 1, 1), 3));
      })
      .catch(() => null);
  }, []);

  const changeBatchRule = (profileId: string) => {
    setBatchRuleProfileId(profileId);
    window.localStorage.setItem("miaoshou:batch-image-rule", profileId);
  };

  const changeBatchConcurrency = (value: number) => {
    const next = Math.min(Math.max(Number(value) || 1, 1), 3);
    setBatchConcurrency(next);
    window.localStorage.setItem("miaoshou:batch-image-concurrency", String(next));
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(products.map((product) => product.id)));
  };

  const toggleOne = (productId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleSkuImage = (productId: string, imageId: string) => {
    setSelectedSkuImages((current) => {
      const productImages = new Set(current[productId] ?? []);
      if (productImages.has(imageId)) productImages.delete(imageId);
      else productImages.add(imageId);
      return { ...current, [productId]: productImages };
    });
    setSelected((current) => new Set(current).add(productId));
  };

  const readError = async (response: Response, fallback: string) => {
    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  };

  const runBatch = async (action: BatchAction) => {
    if (selectedProducts.length === 0 || working) return;
    setWorking(action);
    const actionText = action === "title" ? "重新生成标题" : action === "image" ? "重新生成图片" : "保存到公共采集箱";
    const selectedRule = ruleConfig?.profiles.find((profile) => profile.id === batchRuleProfileId);
    const concurrency = action === "image" ? batchConcurrency : 1;
    let success = 0;
    let completed = 0;
    const failures: string[] = [];
    const notices: string[] = [];

    try {
      setMessage(
        `开始${actionText}：共 ${selectedProducts.length} 个${action === "image" ? `，并发 ${concurrency}，规则：${selectedRule?.name ?? "当前规则"}` : ""}`
      );
      await runWithConcurrency(selectedProducts, concurrency, async (product) => {
        try {
          const imageRequestStartedAt = Date.now();
          const requestedImageIds = action === "image" && selectedSkuImages[product.id]?.size ? [...selectedSkuImages[product.id]] : [];
          const request = () =>
            action === "save"
              ? fetch("/api/miaoshou/sync", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ productId: product.id, saveMode: "LOCAL_ONLY" })
                })
              : fetch(`/api/review/${product.id}/regenerate`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    type: action,
                    ruleProfileId: action === "image" ? batchRuleProfileId : undefined,
                    imageIds: requestedImageIds.length ? requestedImageIds : undefined
                  })
                });

          const response = await request();

          if (!response.ok) {
            const responseError = await readError(response, `${actionText}失败`);
            if (action === "image" && [408, 500, 502, 503, 504].includes(response.status)) {
              setMessage(`${product.miaoshouProductId}：连接超时，图片可能仍在生成，正在等待云端回传（不会重新提交）…`);
              const returnedCount = await waitForReturnedImages(product.id, requestedImageIds, imageRequestStartedAt);
              if (returnedCount > 0) {
                notices.push(`${product.miaoshouProductId}：接口曾超时，但已确认 ${returnedCount} 张图片成功回传云端`);
                success += 1;
                return;
              }
            }
            throw new Error(responseError);
          }
          if (action === "image") {
            const result = (await response.json().catch(() => ({}))) as { failed?: number; message?: string };
            if ((result.failed ?? 0) > 0 && result.message) notices.push(`${product.miaoshouProductId}：${result.message}`);
          }
          success += 1;
        } catch (error) {
          failures.push(`${product.miaoshouProductId}：${error instanceof Error ? error.message : `${actionText}失败`}`);
        } finally {
          completed += 1;
          setMessage(`正在${actionText}：${completed}/${selectedProducts.length}，成功 ${success}，失败 ${failures.length}${action === "image" ? `，并发 ${concurrency}` : ""}`);
        }
      });
      setMessage(
        failures.length > 0
          ? `${actionText}完成：成功 ${success} 个，失败 ${failures.length} 个。第一个失败：${failures[0]}`
          : notices.length > 0
            ? `${actionText}部分完成：${notices[0]}`
            : `${actionText}完成：成功 ${success} 个`
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${actionText}失败`);
    } finally {
      setWorking(null);
    }
  };

  return (
    <div>
      {products.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white p-3">
          <div className="text-sm text-slate-600">已选择 {selected.size} 个商品</div>
          <div className="flex flex-wrap gap-2">
            {ruleConfig ? (
              <label className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm">
                批量洗图规则
                <select className="bg-white" value={batchRuleProfileId || ruleConfig.activeProfileId} onChange={(event) => changeBatchRule(event.target.value)}>
                  {ruleConfig.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm">
              并发（建议 1）
              <select className="bg-white" value={batchConcurrency} onChange={(event) => changeBatchConcurrency(Number(event.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={toggleAll}>
              {allSelected ? "取消全选" : "全选"}
            </button>
            <button
              className="rounded-md border border-line bg-white px-3 py-2 text-sm disabled:opacity-50"
              disabled={selected.size === 0 || working !== null}
              onClick={() => runBatch("title")}
            >
              {working === "title" ? "生成中" : "批量生成标题"}
            </button>
            <button
              className="rounded-md border border-line bg-white px-3 py-2 text-sm disabled:opacity-50"
              disabled={selected.size === 0 || working !== null}
              onClick={() => runBatch("image")}
            >
              {working === "image" ? "洗图中" : "批量洗图"}
            </button>
            <button
              className="rounded-md bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={selected.size === 0 || working !== null}
              onClick={() => runBatch("save")}
            >
              {working === "save" ? "保存中" : "批量保存到公共采集箱"}
            </button>
          </div>
          {message ? <div className="w-full text-right text-xs text-slate-600">{message}</div> : null}
        </div>
      ) : null}
      <table className="w-full text-left text-sm">
        <thead className="bg-cloud text-slate-600">
          <tr>
            <th className="p-3">
              <input aria-label="全选商品" checked={allSelected} type="checkbox" onChange={toggleAll} />
            </th>
            <th className="p-3">妙手商品 ID</th>
            <th className="p-3">图片对比</th>
            <th className="p-3">标题对比</th>
            <th className="p-3">状态</th>
            <th className="p-3">来源</th>
            <th className="p-3">目标平台</th>
            <th className="p-3">图片</th>
            <th className="p-3">SKU</th>
            <th className="p-3">处理状态</th>
            <th className="p-3">更新时间</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-t border-line">
              <td className="p-3">
                <input aria-label={`选择 ${product.miaoshouProductId}`} checked={selected.has(product.id)} type="checkbox" onChange={() => toggleOne(product.id)} />
              </td>
              <td className="p-3 font-mono text-xs">{product.miaoshouProductId}</td>
              <td className="p-3">
                <div className="flex min-w-36 items-center gap-2">
                  <div>
                    <div className="mb-1 text-center text-[10px] text-slate-500">原图</div>
                    {product.mainImageUrl ? <img src={product.mainImageUrl} alt="" referrerPolicy="no-referrer" className="size-[54px] rounded border border-line object-cover" /> : <div className="grid size-[54px] place-items-center rounded border border-line bg-cloud text-[10px] text-slate-400">无图</div>}
                  </div>
                  <div className="pt-5 text-xs text-slate-400">→</div>
                  <div>
                    <div className="mb-1 text-center text-[10px] text-slate-500">优化图</div>
                    {product.optimizedMainImageUrl ? <img src={product.optimizedMainImageUrl} alt="" referrerPolicy="no-referrer" className="size-[54px] rounded border border-emerald-200 object-cover" /> : <div className="grid size-[54px] place-items-center rounded border border-dashed border-line bg-cloud text-[10px] text-slate-400">未生成</div>}
                  </div>
                </div>
              </td>
              <td className="max-w-md p-3">
                <Link className="font-medium hover:text-accent" href={`/review/${product.id}`}>
                  <div className="space-y-1">
                    <div>
                      <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">原</span>
                      {product.originalTitle}
                    </div>
                    <div className={product.optimizedTitle ? "text-emerald-700" : "text-slate-400"}>
                      <span className="mr-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">新</span>
                      {product.optimizedTitle ?? "未生成优化标题"}
                    </div>
                  </div>
                </Link>
              </td>
              <td className="p-3">{product.status}</td>
              <td className="p-3">{product.source}</td>
              <td className="p-3">{product.targetPlatform}</td>
              <td className="p-3">{product.imageCount}</td>
              <td className="p-3">
                <div className="min-w-[170px]">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-sm font-semibold text-slate-700">SKU {product.skuCount}</span>
                    <span className="text-[11px] text-slate-500">颜色 {(product.skuList ?? []).length}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      已洗 {(product.skuList ?? []).filter((sku) => sku.optimizedImageUrl).length}/{(product.skuList ?? []).length}
                    </span>
                  </div>
                  {product.skuCount > 0 ? (
                    <>
                    <div className="mt-2 max-h-[190px] w-[320px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                      <div className="grid grid-cols-6 gap-2">
                        {(product.skuList ?? []).map((sku, skuIndex) => {
                          const isSelected = Boolean(sku.imageId && selectedSkuImages[product.id]?.has(sku.imageId));
                          const hasWashed = Boolean(sku.optimizedImageUrl);
                          const imageUrl = sku.originalImageUrl ?? sku.imageUrl;
                          return (
                            <button
                              key={`${sku.sku}-${skuIndex}`}
                              type="button"
                              disabled={!sku.imageId || !imageUrl}
                              aria-label={`${isSelected ? "取消选择" : "选择"} SKU ${sku.sku}`}
                              title={sku.imageId ? `点击选择这张图洗图 · ${sku.sku}` : `${sku.sku} · 没有可洗原图`}
                              onClick={() => sku.imageId && toggleSkuImage(product.id, sku.imageId)}
                              onMouseEnter={(event) => {
                                if (!imageUrl) return;
                                const rect = event.currentTarget.getBoundingClientRect();
                                setHoverPreview({ sku: sku.sku, originalUrl: imageUrl, optimizedUrl: sku.optimizedImageUrl, top: Math.min(rect.bottom + 8, window.innerHeight - 300), left: Math.min(rect.left, window.innerWidth - 520) });
                              }}
                              onMouseLeave={() => setHoverPreview(null)}
                              className={`relative size-10 overflow-hidden rounded-md border-2 bg-white transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed ${isSelected ? "border-blue-500 ring-2 ring-blue-200" : hasWashed ? "border-emerald-400" : "border-amber-400"}`}
                            >
                              {imageUrl ? <img src={imageUrl} alt={sku.sku} referrerPolicy="no-referrer" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-[9px] text-slate-400">无图</span>}
                              <span className={`absolute right-0 top-0 grid size-3.5 place-items-center rounded-bl text-[9px] font-bold text-white ${isSelected ? "bg-blue-500" : hasWashed ? "bg-emerald-500" : "bg-amber-500"}`}>
                                {isSelected ? "✓" : hasWashed ? "洗" : "原"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500"><span className="text-emerald-600">绿框已洗</span> · <span className="text-amber-600">黄框未洗</span> · <span className="text-blue-600">蓝框已选</span></div>
                    </>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-400">无 SKU</div>
                  )}
                </div>
              </td>
              <td className="p-3">{product.processingStatus}</td>
              <td className="p-3">{product.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hoverPreview ? (
        <div className="pointer-events-none fixed z-[100] w-[500px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl" style={{ top: hoverPreview.top, left: Math.max(12, hoverPreview.left) }}>
          <div className="mb-2 truncate text-xs font-semibold text-slate-700">SKU {hoverPreview.sku}</div>
          <div className="grid grid-cols-2 gap-3">
            <PreviewImage label="未洗原图" url={hoverPreview.originalUrl} borderClass="border-amber-400" />
            {hoverPreview.optimizedUrl ? <PreviewImage label="洗后效果" url={hoverPreview.optimizedUrl} borderClass="border-emerald-400" /> : <div><div className="mb-1 text-center text-xs font-medium text-slate-600">洗后效果</div><div className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">尚未洗图</div></div>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreviewImage({ label, url, borderClass }: { label: string; url: string; borderClass: string }) {
  return <div><div className="mb-1 text-center text-xs font-medium text-slate-600">{label}</div><img src={url} alt={label} referrerPolicy="no-referrer" className={`aspect-square w-full rounded-lg border-2 ${borderClass} bg-white object-contain`} /></div>;
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), items.length || 1);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index], index);
      }
    })
  );
}

async function waitForReturnedImages(productId: string, requestedImageIds: string[], startedAt: number): Promise<number> {
  const expectedCount = Math.max(requestedImageIds.length, 1);
  const requested = new Set(requestedImageIds);
  let bestCount = 0;

  // Railway may close a long HTTP response while the server and image provider
  // continue working. Poll the database instead of submitting the image again.
  for (let attempt = 0; attempt < 36; attempt += 1) {
    await delay(10_000);
    const response = await fetch(`/api/miaoshou/products/${productId}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) continue;
    const product = (await response.json().catch(() => null)) as
      | { images?: Array<{ id: string; optimizations?: Array<{ createdAt?: string; optimizedUrl?: string | null }> }> }
      | null;
    const returned = (product?.images ?? []).filter((image) => {
      if (requested.size > 0 && !requested.has(image.id)) return false;
      return (image.optimizations ?? []).some((optimization) => {
        const createdAt = Date.parse(optimization.createdAt ?? "");
        return Boolean(optimization.optimizedUrl) && Number.isFinite(createdAt) && createdAt >= startedAt - 5_000;
      });
    }).length;
    bestCount = Math.max(bestCount, returned);
    if (returned >= expectedCount) return returned;
  }
  return bestCount;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
