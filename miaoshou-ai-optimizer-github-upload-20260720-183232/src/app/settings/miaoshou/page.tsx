import { SettingsForm } from "@/components/settings-form";

export default function MiaoshouSettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">妙手 API 配置</h1>
      <p className="text-sm text-slate-600">
        已按妙手开放平台文档接入正式签名与公共采集箱、Shopee 采集箱、TikTok 采集箱接口。生产环境建议优先写入 .env。
      </p>
      <SettingsForm provider="MIAOSHOU" />
    </div>
  );
}
