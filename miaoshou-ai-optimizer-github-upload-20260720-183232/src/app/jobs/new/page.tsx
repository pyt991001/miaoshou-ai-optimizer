import { CreateJobForm } from "@/components/create-job-form";
import { prisma } from "@/lib/db/prisma";
import { safeQuery } from "@/lib/db/safe-query";
import { requirePageUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const user = await requirePageUser();
  const products = await safeQuery(() => prisma.product.findMany({ where: { userId: user.id }, select: { miaoshouProductId: true }, take: 500 }), [], "new-job-page");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">新建处理任务</h1>
      <CreateJobForm productIds={products.map((product) => product.miaoshouProductId)} />
    </div>
  );
}
