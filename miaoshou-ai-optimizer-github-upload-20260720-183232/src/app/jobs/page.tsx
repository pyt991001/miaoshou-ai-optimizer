import Link from "next/link";
import { JobsAutoRefresh } from "@/components/jobs-auto-refresh";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const runningStatuses = new Set([
  "FETCHING",
  "DOWNLOADING",
  "OPTIMIZING_TITLE",
  "PROCESSING_IMAGES",
  "VALIDATING",
  "SAVING_TO_MIAOSHOU"
]);

const statusMeta: Record<string, { label: string; badge: string; bar: string }> = {
  PENDING: { label: "等待处理", badge: "bg-slate-100 text-slate-700", bar: "bg-slate-400" },
  FETCHING: { label: "正在导入", badge: "bg-blue-100 text-blue-700", bar: "bg-blue-500" },
  DOWNLOADING: { label: "下载图片", badge: "bg-sky-100 text-sky-700", bar: "bg-sky-500" },
  OPTIMIZING_TITLE: { label: "优化标题", badge: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500" },
  PROCESSING_IMAGES: { label: "正在洗图", badge: "bg-violet-100 text-violet-700", bar: "bg-violet-500" },
  VALIDATING: { label: "检查结果", badge: "bg-cyan-100 text-cyan-700", bar: "bg-cyan-500" },
  WAITING_REVIEW: { label: "等待审核", badge: "bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  SAVING_TO_MIAOSHOU: { label: "保存到妙手", badge: "bg-blue-100 text-blue-700", bar: "bg-blue-500" },
  COMPLETED: { label: "处理完成", badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  PARTIALLY_COMPLETED: { label: "部分完成", badge: "bg-orange-100 text-orange-700", bar: "bg-orange-500" },
  FAILED: { label: "处理失败", badge: "bg-red-100 text-red-700", bar: "bg-red-500" },
  CANCELLED: { label: "已取消", badge: "bg-slate-100 text-slate-600", bar: "bg-slate-400" }
};

export default async function JobsPage() {
  const products = await prisma.product
    .findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        images: {
          include: {
            optimizations: { orderBy: { createdAt: "desc" }, take: 1 }
          }
        }
      }
    })
    .catch(() => []);

  const rows = products.map((product) => {
    const optimizedImages = product.images.filter((image) => Boolean(image.optimizations[0]?.optimizedUrl)).length;
    const hasTitle = Boolean(product.optimizedTitle);
    const status = product.processingStatus;
    const progress = getProgress(status, hasTitle, optimizedImages > 0);
    return { ...product, optimizedImages, hasTitle, progress };
  });

  const running = rows.filter((row) => runningStatuses.has(row.processingStatus)).length;
  const waiting = rows.filter((row) => row.processingStatus === "WAITING_REVIEW").length;
  const completed = rows.filter((row) => row.processingStatus === "COMPLETED").length;
  const failed = rows.filter((row) => row.processingStatus === "FAILED").length;
  const overallProgress = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length) : 0;

  return (
    <div className="space-y-6">
      <JobsAutoRefresh />

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
              <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
              每 5 秒自动刷新
            </div>
            <h1 className="text-3xl font-bold tracking-tight">任务进度中心</h1>
            <p className="mt-2 text-sm text-slate-300">实时查看标题优化、图片处理、人工审核和妙手保存状态。</p>
          </div>
          <Link className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow hover:bg-slate-100" href="/products">
            返回商品列表
          </Link>
        </div>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-200">整体处理进度</span>
            <span className="text-xl font-bold">{overallProgress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon="▦" label="全部商品" value={rows.length} color="slate" />
        <StatCard icon="↻" label="正在处理" value={running} color="blue" />
        <StatCard icon="!" label="等待审核" value={waiting} color="amber" />
        <StatCard icon="✓" label="处理完成" value={completed} color="green" />
        <StatCard icon="×" label="处理失败" value={failed} color="red" />
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50/80 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">商品处理明细</h2>
            <p className="mt-1 text-xs text-slate-500">点击商品编号可进入审核页面查看和调整结果</p>
          </div>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">共 {rows.length} 条</span>
        </div>

        {rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-slate-100 text-2xl">▦</div>
              <div className="mt-4 font-semibold text-slate-800">还没有任务数据</div>
              <div className="mt-1 text-sm text-slate-500">请先前往商品页面导入妙手公共采集箱商品。</div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((row) => {
              const meta = statusMeta[row.processingStatus] ?? statusMeta.PENDING;
              return (
                <article className="p-5 transition-colors hover:bg-slate-50/70" key={row.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link className="font-mono text-sm font-bold text-slate-900 hover:text-indigo-600" href={`/review/${row.id}`}>
                          #{row.miaoshouProductId}
                        </Link>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
                      </div>
                      <div className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-700">{row.optimizedTitle ?? row.originalTitle}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <StepBadge done label="已导入" />
                        <StepBadge done={row.hasTitle} label="标题" />
                        <StepBadge done={row.optimizedImages > 0} label={`洗图 ${row.optimizedImages}/${row.images.length}`} />
                        <StepBadge done={["WAITING_REVIEW", "COMPLETED"].includes(row.processingStatus)} label="审核" />
                        <StepBadge done={row.processingStatus === "COMPLETED"} label="已保存" />
                      </div>
                    </div>

                    <div className="w-full sm:w-64">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                        <span>当前进度</span>
                        <span className="font-bold text-slate-800">{row.progress}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${meta.bar} transition-all`} style={{ width: `${row.progress}%` }} />
                      </div>
                      <div className="mt-2 text-right text-[11px] text-slate-400">更新于 {formatDate(row.updatedAt)}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: "slate" | "blue" | "amber" | "green" | "red" }) {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700"
  };
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className={`grid size-9 place-items-center rounded-lg text-lg font-bold ${colors[color]}`}>{icon}</div>
        <div className="text-3xl font-bold tracking-tight text-slate-900">{value}</div>
      </div>
      <div className="mt-3 text-sm font-medium text-slate-600">{label}</div>
    </div>
  );
}

function StepBadge({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
      <span className={`size-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-slate-300"}`} />
      {label}
    </span>
  );
}

function getProgress(status: string, hasTitle: boolean, hasImage: boolean) {
  if (status === "COMPLETED") return 100;
  if (status === "SAVING_TO_MIAOSHOU") return 90;
  if (status === "WAITING_REVIEW") return 80;
  if (status === "VALIDATING") return 70;
  if (status === "PROCESSING_IMAGES") return 55;
  if (status === "OPTIMIZING_TITLE") return 35;
  if (status === "DOWNLOADING") return 20;
  if (status === "FETCHING") return 10;
  if (status === "FAILED") return hasImage ? 75 : hasTitle ? 45 : 15;
  return hasImage ? 70 : hasTitle ? 40 : 5;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}
