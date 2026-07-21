import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { safeQuery } from "@/lib/db/safe-query";
import { requirePageUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requirePageUser();
  const [products, jobs, errors] = await Promise.all([
    safeQuery(() => prisma.product.count({ where: { userId: user.id } }), 0, "home-products-count"),
    safeQuery(() => prisma.processingJob.count({ where: { userId: user.id } }), 0, "home-jobs-count"),
    safeQuery(() => prisma.errorLog.count({ where: { userId: user.id } }), 0, "home-errors-count")
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">跨境电商商品 AI 优化系统</h1>
        <p className="mt-2 text-sm text-slate-600">从妙手拉取商品，优化标题与图片，审核后保存回妙手采集箱。</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          ["商品数", products],
          ["任务数", jobs],
          ["错误日志", errors]
        ].map(([label, value]) => (
          <div key={label} className="panel p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Link className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" href="/products">
          查看商品
        </Link>
        <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium" href="/jobs/new">
          新建处理任务
        </Link>
      </div>
    </div>
  );
}
