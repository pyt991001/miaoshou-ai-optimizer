"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImportProductsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importLimit, setImportLimit] = useState(50);
  const [message, setMessage] = useState<string | null>(null);
  const clearDemoProducts = async () => {
    setClearing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/miaoshou/products", { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { deletedFromDatabase?: number; message?: string; error?: string; warning?: string };
      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "清空商品失败");
      }
      setMessage(data.warning ?? `已清空商品：${data.deletedFromDatabase ?? 0} 个`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清空商品失败");
    } finally {
      setClearing(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <label className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-700">
          导入数量
          <select
            className="bg-white font-medium outline-none"
            value={importLimit}
            disabled={loading || clearing}
            onChange={(event) => setImportLimit(Number(event.target.value))}
          >
            <option value={10}>10 个</option>
            <option value={20}>20 个</option>
            <option value={50}>50 个</option>
            <option value={100}>100 个</option>
          </select>
        </label>
        <button
          className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          disabled={clearing || loading}
          onClick={clearDemoProducts}
        >
          {clearing ? "清空中" : "清空全部商品"}
        </button>
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={loading || clearing}
          onClick={async () => {
            setLoading(true);
            setMessage(null);
            try {
              const response = await fetch("/api/miaoshou/products", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ limit: importLimit })
              });
              const data = (await response.json().catch(() => ({}))) as { imported?: number; message?: string; error?: string; warning?: string; storage?: string };
              if (!response.ok) {
                throw new Error(data.message ?? data.error ?? "导入失败，请确认数据库已启动");
              }
              setMessage(data.warning ?? `已导入 ${data.imported ?? 0} 个商品${data.storage === "local-file" ? "（本地临时保存）" : ""}`);
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "导入失败，请检查妙手配置或数据库");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "导入中" : "导入妙手公共采集箱商品"}
        </button>
      </div>
      {message ? <span className="max-w-xs text-right text-xs text-slate-600">{message}</span> : null}
    </div>
  );
}
