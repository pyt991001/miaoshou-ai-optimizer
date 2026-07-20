"use client";

import { useRouter } from "next/navigation";

export function JobActions({ id }: { id: string }) {
  const router = useRouter();
  const action = async (name: string) => {
    await fetch(`/api/jobs/${id}/${name}`, { method: "POST" });
    router.refresh();
  };
  return (
    <div className="flex gap-2">
      <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={() => action("pause")}>暂停</button>
      <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={() => action("resume")}>恢复</button>
      <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={() => action("retry")}>重试失败</button>
      <button className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700" onClick={() => action("cancel")}>取消</button>
    </div>
  );
}
