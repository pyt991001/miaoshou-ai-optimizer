"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateJobForm({ productIds }: { productIds: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(productIds);
  const [name, setName] = useState("AI 商品优化批量任务");
  return (
    <form
      className="panel grid gap-4 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, miaoshouProductIds: selected })
        });
        const job = await response.json();
        router.push(`/jobs/${job.id}`);
      }}
    >
      <label className="grid gap-1 text-sm">
        任务名称
        <input className="rounded-md border border-line px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        妙手商品 ID，每行一个
        <textarea
          className="min-h-40 rounded-md border border-line px-3 py-2 font-mono text-xs"
          value={selected.join("\n")}
          onChange={(event) => setSelected(event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean))}
        />
      </label>
      <button className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">创建任务</button>
    </form>
  );
}
