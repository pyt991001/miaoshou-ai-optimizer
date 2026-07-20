import { ImageRulesForm } from "@/components/image-rules-form";
import { readImageRuleConfig } from "@/lib/openai/image-rule-config";

export default async function ImageRulesPage() {
  const config = await readImageRuleConfig();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">图片优化规则</h1>
      <ImageRulesForm initialConfig={config} />
    </div>
  );
}
