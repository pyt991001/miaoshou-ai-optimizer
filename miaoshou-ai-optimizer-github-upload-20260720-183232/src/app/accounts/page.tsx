import { requirePageUser } from "@/lib/auth/session";
import { AccountManager } from "@/components/account-manager";

export default async function AccountsPage() {
  const user = await requirePageUser();
  if (user.role !== "ADMIN") return <div className="panel p-6"><h1 className="text-xl font-semibold">无权访问</h1><p className="mt-2 text-sm text-slate-600">只有主账户可以创建和管理子账户。</p></div>;
  return <div className="space-y-4"><div><h1 className="text-2xl font-semibold">子账户管理</h1><p className="mt-1 text-sm text-slate-600">每个子账户拥有独立商品、任务、日志和 API Key。</p></div><AccountManager /></div>;
}
