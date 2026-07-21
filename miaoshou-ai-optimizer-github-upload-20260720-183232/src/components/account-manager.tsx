"use client";

import { useEffect, useState } from "react";

type Account = { id: string; email: string; name: string | null; role: "ADMIN" | "MEMBER"; active: boolean };

export function AccountManager() {
  const [users, setUsers] = useState<Account[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const load = () => fetch("/api/accounts").then((response) => response.json()).then((data: { users?: Account[] }) => setUsers(data.users ?? []));
  useEffect(() => { void load(); }, []);
  return <div className="space-y-4">
    <form className="panel grid gap-3 p-5 md:grid-cols-4" onSubmit={async (event) => {
      event.preventDefault(); setMessage(null); const form = new FormData(event.currentTarget);
      const response = await fetch("/api/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      const data = (await response.json()) as { message?: string }; setMessage(response.ok ? "子账户已创建" : data.message ?? "创建失败");
      if (response.ok) { event.currentTarget.reset(); await load(); }
    }}>
      <input className="rounded-md border border-line px-3 py-2" name="name" placeholder="姓名/备注" />
      <input className="rounded-md border border-line px-3 py-2" name="email" placeholder="登录邮箱" type="email" required />
      <input className="rounded-md border border-line px-3 py-2" name="password" placeholder="初始密码（至少 10 位）" type="password" required />
      <button className="rounded-md bg-accent px-4 py-2 text-white">创建子账户</button>
      {message ? <div className="text-sm text-slate-600 md:col-span-4">{message}</div> : null}
    </form>
    <div className="panel divide-y divide-line overflow-hidden">{users.map((user) => <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={user.id}><div><div className="font-medium">{user.name || "未命名"} <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">{user.role === "ADMIN" ? "主账户" : "子账户"}</span></div><div className="mt-1 text-sm text-slate-500">{user.email}</div></div><div className="flex items-center gap-2"><span className={`text-xs ${user.active ? "text-emerald-700" : "text-red-700"}`}>{user.active ? "正常" : "已停用"}</span>{user.role === "MEMBER" ? <button className="rounded-md border border-line px-3 py-1.5 text-sm" onClick={async () => { await fetch(`/api/accounts/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !user.active }) }); await load(); }}>{user.active ? "停用" : "启用"}</button> : null}</div></div>)}</div>
  </div>;
}
