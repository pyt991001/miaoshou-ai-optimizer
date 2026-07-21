"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return <Suspense fallback={<div className="grid min-h-[80vh] place-items-center text-sm text-slate-500">正在打开登录页面…</div>}><LoginForm /></Suspense>;
}

function LoginForm() {
  const next = useSearchParams().get("next") || "/products";
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <div className="grid min-h-[80vh] place-items-center">
      <form className="panel w-full max-w-md space-y-4 p-7" onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setMessage(null);
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        if (!response.ok) { setMessage(data.message ?? "登录失败"); setLoading(false); return; }
        window.location.href = next.startsWith("/") ? next : "/products";
      }}>
        <div><h1 className="text-2xl font-semibold">登录商品 AI 优化系统</h1><p className="mt-1 text-sm text-slate-600">每个账户使用独立商品数据和 API Key。</p></div>
        <input className="w-full rounded-md border border-line px-3 py-2.5" name="email" placeholder="邮箱" type="email" required />
        <input className="w-full rounded-md border border-line px-3 py-2.5" name="password" placeholder="密码（至少 10 位）" type="password" required />
        <button className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-50" disabled={loading}>{loading ? "登录中…" : "登录"}</button>
        {message ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</div> : null}
      </form>
    </div>
  );
}
