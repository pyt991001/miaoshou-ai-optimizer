import { SettingsForm } from "@/components/settings-form";

export default function StorageSettingsPage() {
  return <div className="space-y-4"><h1 className="text-2xl font-semibold">Cloudflare R2 配置</h1><p className="text-sm text-slate-600">仅用于当前登录账户，Key 会加密保存，保存后不会返回浏览器。</p><SettingsForm provider="STORAGE" /></div>;
}
