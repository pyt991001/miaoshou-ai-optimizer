import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

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

export default async function JobsPage() {
  const products = await prisma.product
    .findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        images: {
          include: {
            optimizations: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        }
      }
    })
    .catch(() => []);

  const completed = products.filter(
    (product) => product.processingStatus === "COMPLETED"
  ).length;

  const failed = products.filter(
    (product) => product.processingStatus === "FAILED"
  ).length;

  const waiting = products.filter(
    (product) => product.processingStatus === "WAITING_REVIEW"
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">任务进度</h1>
          <p className="mt-1 text-sm text-slate-600">
            查看每个商品当前的处理状态。
          </p>
        </div>

        <Link
          className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white"
          href="/products"
        >
          返回商品列表
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="全部商品" value={products.length} />
        <StatCard label="待审核" value={waiting} />
        <StatCard label="已完成" value={completed} />
        <StatCard label="失败" value={failed} />
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-line p-4">
          <h2 className="text-lg font-semibold">商品处理明细</h2>
        </div>

        {products.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">
            暂无任务数据，请先导入商品。
          </div>
        ) : (
          <div className="divide-y divide-line">
            {products.map((product) => {
              const optimizedImages = product.images.filter(
                (image) =>
                  Boolean(image.optimizations[0]?.optimizedUrl)
              ).length;

              return (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                  key={product.id}
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      className="font-mono text-sm font-medium hover:text-accent"
                      href={`/review/${product.id}`}
                    >
                      {product.miaoshouProductId}
                    </Link>

                    <div className="mt-1 line-clamp-2 text-sm text-slate-700">
                      {product.optimizedTitle ?? product.originalTitle}
                    </div>

                    <div className="mt-2 text-xs text-slate-500">
                      已洗图片：{optimizedImages}/{product.images.length}
                    </div>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {statusText[product.processingStatus] ??
                      product.processingStatus}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="panel p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
