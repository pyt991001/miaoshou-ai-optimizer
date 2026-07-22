"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JobsCheckButton() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  return (
    <button
      className="rounded-md border border-accent bg-white px-4 py-2 text-sm font-medium text-accent disabled:opacity-60"
      disabled={checking}
      onClick={() => {
        setChecking(true);
        router.refresh();
        window.setTimeout(() => setChecking(false), 900);
      }}
    >
      {checking ? "正在检查…" : "检查是否完成"}
    </button>
  );
}
