import Link from "next/link";
import { JobsAutoRefresh } from "@/components/jobs-auto-refresh";
import { readLocalProducts, type LocalProduct } from "@/lib/products/local-store";

export const dynamic = "force-dynamic";

const runningStatuses = new Set(["FETCHING", "DOWNLOADING", "OPTIMIZING_TITLE", "PROCESSING_IMAGES", "VALIDATING", "SAVING_TO_MIAOSHOU"]);

const statusText: Record<string, string> = {
  PENDING: "待处理",
  FETCHING: "正在拉取商品",
  DOWNLOADING: "正在下载图片",
  OPTIMIZING_TITLE: "正在生成标题",
  PROCESSING_IMAGES: "正在洗图",
  VALIDATING: "正在检查结果",
  WAITING_REVIEW: "待人工审核",
  SAVING_TO_MIAOSHOU: "正在保存到公共采集箱",
  COMPLETED: "已完成",
  PARTIALLY_COMPLETED: "部分完成",
  FAILED: "失败",
  CANCELLED: "已取消"
};

const statusClass: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  FETCHING: "bg-blue-50 text-blue-700",
  DOWNLOADING: "bg-blue-50 text-blue-700",
  OPTIMIZING_TITLE: "bg-indigo-50 text-indigo-700",
  PROCESSING_IMAGES: "bg-violet-50 text-violet-700",
  VALIDATING: "bg-cyan-50 text-cyan-700",
  WAITING_REVIEW: "bg-amber-50 text-amber-700",
  SAVING_TO_MIAOSHOU: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  PARTIALLY_COMPLETED: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-600"
};

const steps = [
  { key: "imported", label: "导入" },
  { key: "title", label: "标题" },
  { key: "image", label: "洗图" },
  { key: "review", label: "审核" },
  { key: "save", label: "保存" }
] as const;

type StepKey = (typeof steps)[number]["key"];

export default async function JobsPage() {
  const products = await readLocalProducts();
  const rows = products.map(toProgressRow);
  const total = rows.length;
  const running = rows.filter((row) => runningStatuses.has(row.status));
  const waitingReview = rows.filter((row) => row.status === "WAITING_REVIEW");
  const completed = rows.filter((row) => row.status === "COMPLETED");
  const failed = rows.filter((row) => row.status === "FAILED");
  const averageProgress = total ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / total) : 0;

  return (
    <div className="space-y-5">
      <JobsAutoRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">任务进度</h1>
          <p className="mt-1 text-sm text-slate-600">自动刷新；这里显示商品做到哪一步、哪些正在处理、哪些需要你审核。</p>
        </div>
        <Link className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white" href="/products">
          回商品列表
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <StatCard label="全部商品" value={total} />
        <StatCard label="正在处理" value={running.length} tone="blue" />
        <StatCard label="待人工审核" value={waitingReview.length} tone="amber" />
        <StatCard label="已完成" value={completed.length} tone="green" />
        <StatCard label="失败" value={failed.length} tone="red" />
      </div>

      <div className="panel p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">整体进度</span>
          <span className="text-slate-600">{averageProgress}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-cloud">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${averageProgress}%` }} />
        </div>
      </div>

      <section className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">正在做</h2>
          <span className="text-xs text-slate-500">每 5 秒自动刷新</span>
        </div>
        {running.length > 0 ? (
          <div className="grid gap-3">
            {running.map((row) => (
              <ProgressItem key={row.id} row={row} compact />
            ))}
          </div>
        ) : (
          <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">现在没有正在跑的任务。你去商品列表点“批量生成标题 / 批量洗图 / 批量保存”后，这里会显示当前进行中。</div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-4">
          <h2 className="text-lg font-semibold">商品处理明细</h2>
          <p className="mt-1 text-sm text-slate-600">一行一个商品，绿点是已完成，蓝点是正在做，灰点是未开始。</p>
        </div>
        {rows.length > 0 ? (
          <div className="divide-y divide-line">
            {rows.map((row) => (
              <ProgressItem key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-600">还没有商品。先去“商品”页面导入妙手公共采集箱商品。</div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "blue" | "amber" | "green" | "red" }) {
  const toneClass = {
    slate: "text-slate-900",
    blue: "text-blue-700",
    amber: "text-amber-700",
    green: "text-emerald-700",
    red: "text-red-700"
  }[tone];

  return (
    <div className="panel p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function ProgressItem({ row, compact = false }: { row: ReturnType<typeof toProgressRow>; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-md border border-line p-3" : "p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="font-mono text-sm font-medium hover:text-accent" href={`/review/${row.id}`}>
              {row.miaoshouProductId}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[row.status] ?? "bg-slate-100 text-slate-700"}`}>{statusText[row.status] ?? row.status}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-sm text-slate-700">{row.title}</div>
          {row.lastError ? <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">失败原因：{row.lastError}</div> : null}
        </div>
        <div className="w-full sm:w-56">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>{row.currentText}</span>
            <span>{row.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cloud">
            <div className={`h-full rounded-full ${row.status === "FAILED" ? "bg-red-500" : "bg-accent"}`} style={{ width: `${row.progress}%` }} />
          </div>
        </div>
      </div>
      {!compact ? (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {steps.map((step) => (
            <StepPill key={step.key} label={step.label} state={row.steps[step.key]} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StepPill({ label, state }: { label: string; state: "done" | "doing" | "todo" | "failed" }) {
  const className = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-700",
    doing: "border-blue-200 bg-blue-50 text-blue-700",
    todo: "border-line bg-slate-50 text-slate-500",
    failed: "border-red-200 bg-red-50 text-red-700"
  }[state];

  const dotClass = {
    done: "bg-emerald-500",
    doing: "bg-blue-500",
    todo: "bg-slate-300",
    failed: "bg-red-500"
  }[state];

  return (
    <div className={`flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs ${className}`}>
      <span className={`size-2 rounded-full ${dotClass}`} />
      {label}
    </div>
  );
}

function toProgressRow(product: LocalProduct) {
  const hasTitle = Boolean(product.optimizedTitle);
  const hasImage = product.images.some((image) => Boolean(image.optimizedUrl));
  const status = product.processingStatus;
  const stepStates: Record<StepKey, "done" | "doing" | "todo" | "failed"> = {
    imported: "done",
    title: hasTitle ? "done" : "todo",
    image: hasImage ? "done" : "todo",
    review: status === "WAITING_REVIEW" || status === "COMPLETED" ? "done" : "todo",
    save: status === "COMPLETED" ? "done" : "todo"
  };

  if (status === "OPTIMIZING_TITLE") stepStates.title = "doing";
  if (status === "PROCESSING_IMAGES") stepStates.image = "doing";
  if (status === "SAVING_TO_MIAOSHOU") stepStates.save = "doing";
  if (status === "FAILED") {
    if (!hasTitle) stepStates.title = "failed";
    else if (!hasImage) stepStates.image = "failed";
    else stepStates.save = "failed";
  }

  const doneCount = steps.filter((step) => stepStates[step.key] === "done").length;
  const doingCount = steps.some((step) => stepStates[step.key] === "doing") ? 0.5 : 0;
  const progress = Math.min(100, Math.round(((doneCount + doingCount) / steps.length) * 100));

  return {
    id: product.id,
    miaoshouProductId: product.miaoshouProductId,
    title: product.optimizedTitle ?? product.originalTitle,
    status,
    lastError: product.lastError ?? null,
    currentText: statusText[status] ?? status,
    progress,
    steps: stepStates,
    updatedAt: product.updatedAt
  };
}
