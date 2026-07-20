"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewActions({ productId, titleOptimizationId }: { productId: string; titleOptimizationId?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const decide = async (decision: "ACCEPTED" | "REJECTED" | "NEEDS_REVIEW") => {
    await fetch(`/api/review/${productId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ titleOptimizationId, decision })
    });
    router.refresh();
  };
  const sync = async (saveMode: "LOCAL_ONLY" | "PLATFORM_COLLECTION_BOX") => {
    setWorking("sync");
    setMessage("正在保存...");
    try {
      const response = await fetch("/api/miaoshou/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, saveMode })
      });
      const data = (await response.json().catch(() => ({}))) as { status?: string; message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "保存失败，请检查妙手配置");
      }
      setMessage(`保存成功：${data.status ?? "已回写妙手"}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败，请检查妙手配置");
    } finally {
      setWorking(null);
    }
  };
  const regenerate = async (type: "title" | "image") => {
    setWorking(type);
    const imageIds = type === "image" ? readSelectedImageIds(productId) : [];
    const ruleProfileId = type === "image" ? readSelectedRuleProfileId(productId) : undefined;
    setMessage(type === "title" ? "正在重新生成标题..." : `正在重新生成图片：${imageIds.length || 1} 张...`);
    try {
      const response = await fetch(`/api/review/${productId}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, imageIds, ruleProfileId })
      });
      const data = (await response.json().catch(() => ({}))) as { optimizedTitle?: string; message?: string; error?: string; regenerated?: number };
      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "重新生成失败");
      }
      setMessage(type === "title" ? `标题已重新生成：${data.optimizedTitle ?? ""}` : `图片已重新生成：${data.regenerated ?? 0} 张`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重新生成失败");
    } finally {
      setWorking(null);
    }
  };
  return (
    <div className="flex max-w-xl flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button className="rounded-md bg-accent px-3 py-2 text-sm text-white" onClick={() => decide("ACCEPTED")}>接受标题</button>
        <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={() => decide("NEEDS_REVIEW")}>需要人工检查</button>
        <button className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700" onClick={() => decide("REJECTED")}>拒绝</button>
        <button className="rounded-md border border-line bg-white px-3 py-2 text-sm disabled:opacity-60" disabled={working !== null} onClick={() => regenerate("title")}>
          {working === "title" ? "生成中" : "重新生成标题"}
        </button>
        <button className="rounded-md border border-line bg-white px-3 py-2 text-sm disabled:opacity-60" disabled={working !== null} onClick={() => regenerate("image")}>
          {working === "image" ? "生成中" : "重新生成图片"}
        </button>
        <button className="rounded-md border border-line bg-white px-3 py-2 text-sm">恢复原标题</button>
        <button className="rounded-md bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-60" disabled={working !== null} onClick={() => sync("LOCAL_ONLY")}>保存到公共采集箱</button>
      </div>
      {message ? <div className="text-right text-xs text-slate-600">{message}</div> : null}
    </div>
  );
}

function readSelectedImageIds(productId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`miaoshou:selected-images:${productId}`);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  } catch {
    return [];
  }
}

function readSelectedRuleProfileId(productId: string): string | undefined {
  try {
    return window.localStorage.getItem(`miaoshou:selected-image-rule:${productId}`) || undefined;
  } catch {
    return undefined;
  }
}
