import { JobActions } from "@/components/job-actions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.processingJob.findUnique({ where: { id }, include: { tasks: true } });
  if (!job) return <div>任务不存在</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{job.name}</h1>
        <JobActions id={job.id} />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[
          ["状态", job.status],
          ["商品总数", job.totalProducts],
          ["完成", job.completedCount],
          ["失败", job.failedCount]
        ].map(([label, value]) => (
          <div className="panel p-4" key={label}>
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      {job.pauseReason ? <div className="panel border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{job.pauseReason}</div> : null}
      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-cloud">
            <tr><th className="p-3">类型</th><th className="p-3">状态</th><th className="p-3">重试</th><th className="p-3">错误</th></tr>
          </thead>
          <tbody>
            {job.tasks.map((task) => (
              <tr className="border-t border-line" key={task.id}>
                <td className="p-3">{task.type}</td>
                <td className="p-3">{task.status}</td>
                <td className="p-3">{task.attempts}/{task.maxAttempts}</td>
                <td className="p-3">{task.errorMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
