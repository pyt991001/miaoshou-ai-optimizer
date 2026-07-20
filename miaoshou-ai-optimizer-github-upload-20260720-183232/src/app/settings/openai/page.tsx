import { SettingsForm } from "@/components/settings-form";

export default function OpenAISettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">OpenAI API 配置</h1>
      <p className="text-sm text-slate-600">API Key 仅保存在服务端，并以 AES-256-GCM 加密入库。</p>
      <SettingsForm provider="OPENAI" />
    </div>
  );
}
