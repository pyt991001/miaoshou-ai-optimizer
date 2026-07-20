"use client";

import Image from "next/image";
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
  const [batchConcurrency, setBatchConcurrency] = useState(3);

  const selectedProducts = useMemo(() => products.filter((product) => selected.has(product.id)), [products, selected]);
  const allSelected = products.length > 0 && selected.size === products.length;

  useEffect(() => {
    fetch("/api/rules/images")
      .then((response) => response.json())
      .then((data: { config?: StoredImageRuleConfig }) => {
        if (!data.config) return;
        setRuleConfig(data.config);
        setBatchRuleProfileId(window.localStorage.getItem("miaoshou:batch-image-rule") || data.config.activeProfileId);
        setBatchConcurrency(Number(window.localStorage.getItem("miaoshou:batch-image-concurrency") || 3));
      })
      .catch(() => null);
  }, []);

  const changeBatchRule = (profileId: string) => {
    setBatchRuleProfileId(profileId);
    window.localStorage.setItem("miaoshou:batch-image-rule", profileId);
  };

  const changeBatchConcurrency = (value: number) => {
    const next = Math.min(Math.max(Number(value) || 3, 1), 10);
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

    try {
      setMessage(
        `开始${actionText}：共 ${selectedProducts.length} 个${action === "image" ? `，并发 ${concurrency}，规则：${selectedRule?.name ?? "当前规则"}` : ""}`
      );
      await runWithConcurrency(selectedProducts, concurrency, async (product) => {
        try {
          const response =
            action === "save"
              ? await fetch("/api/miaoshou/sync", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ productId: product.id, saveMode: "LOCAL_ONLY" })
                })
              : await fetch(`/api/review/${product.id}/regenerate`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ type: action, ruleProfileId: action === "image" ? batchRuleProfileId : undefined })
                });

          if (!response.ok) {
            throw new Error(await readError(response, `${actionText}失败`));
          }
          success += 1;
        } catch (error) {
          failures.push(`${product.miaoshouProductId}：${error instanceof Error ? error.message : `${actionText}失败`}`);
        } finally {
          completed += 1;
          setMessage(`正在${actionText}：${completed}/${selectedProducts.length}，成功 ${success}，失败 ${failures.length}${action === "image" ? `，并发 ${concurrency}` : ""}`);
        }
      });
      setMessage(failures.length > 0 ? `${actionText}完成：成功 ${success} 个，失败 ${failures.length} 个。第一个失败：${failures[0]}` : `${actionText}完成：成功 ${success} 个`);
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
              并发
              <select className="bg-white" value={batchConcurrency} onChange={(event) => changeBatchConcurrency(Number(event.target.value))}>
                <option value={1}>1</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
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
                    {product.mainImageUrl ? <Image src={product.mainImageUrl} alt="" width={54} height={54} className="rounded border border-line object-cover" /> : <div className="grid size-[54px] place-items-center rounded border border-line bg-cloud text-[10px] text-slate-400">无图</div>}
                  </div>
                  <div className="pt-5 text-xs text-slate-400">→</div>
                  <div>
                    <div className="mb-1 text-center text-[10px] text-slate-500">优化图</div>
                    {product.optimizedMainImageUrl ? <Image src={product.optimizedMainImageUrl} alt="" width={54} height={54} className="rounded border border-emerald-200 object-cover" /> : <div className="grid size-[54px] place-items-center rounded border border-dashed border-line bg-cloud text-[10px] text-slate-400">未生成</div>}
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
              <td className="p-3">{product.skuCount}</td>
              <td className="p-3">{product.processingStatus}</td>
              <td className="p-3">{product.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
