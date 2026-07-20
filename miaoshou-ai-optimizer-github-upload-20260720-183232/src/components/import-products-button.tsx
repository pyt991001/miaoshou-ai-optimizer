"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImportProductsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const clearDemoProducts = async () => {
    setClearing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/miaoshou/products", { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { deletedFromDatabase?: number; message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "清空演示商品失败");
      }
      setMessage(`已清空演示商品${data.deletedFromDatabase ? `：${data.deletedFromDatabase} 个` : ""}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清空演示商品失败");
    } finally {
      setClearing(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          disabled={clearing || loading}
          onClick={clearDemoProducts}
        >
          {clearing ? "清空中" : "清空演示商品"}
        </button>
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={loading || clearing}
          onClick={async () => {
            setLoading(true);
            setMessage(null);
            try {
              const response = await fetch("/api/miaoshou/products", { method: "POST" });
              const data = (await response.json().catch(() => ({}))) as { imported?: number; message?: string; error?: string; storage?: string };
              if (!response.ok) {
                throw new Error(data.message ?? data.error ?? "导入失败，请确认数据库已启动");
              }
              setMessage(`已导入 ${data.imported ?? 0} 个商品${data.storage === "local-file" ? "（本地临时保存）" : ""}`);
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
