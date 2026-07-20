import { prisma } from "@/lib/db/prisma";
import { safeQuery } from "@/lib/db/safe-query";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const [errors, audits] = await Promise.all([
    safeQuery(() => prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }), [], "logs-errors"),
    safeQuery(() => prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }), [], "logs-audits")
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">操作日志和错误日志</h1>
      <section className="panel overflow-hidden">
        <h2 className="p-4 font-semibold">错误日志</h2>
        <table className="w-full text-left text-sm">
          <tbody>{errors.map((item) => <tr className="border-t border-line" key={item.id}><td className="p-3">{item.scope}</td><td className="p-3">{item.code}</td><td className="p-3">{item.message}</td><td className="p-3">{item.createdAt.toLocaleString()}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="panel overflow-hidden">
        <h2 className="p-4 font-semibold">审计日志</h2>
        <table className="w-full text-left text-sm">
          <tbody>{audits.map((item) => <tr className="border-t border-line" key={item.id}><td className="p-3">{item.action}</td><td className="p-3">{item.entity}</td><td className="p-3">{item.entityId}</td><td className="p-3">{item.createdAt.toLocaleString()}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
