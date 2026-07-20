export default function TitleRulesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">标题优化规则</h1>
      <div className="panel grid max-w-3xl gap-3 p-5">
        <input className="rounded-md border border-line px-3 py-2" defaultValue="English" placeholder="目标语言" />
        <input className="rounded-md border border-line px-3 py-2" defaultValue="Shopee" placeholder="目标平台" />
        <input className="rounded-md border border-line px-3 py-2" defaultValue="120" placeholder="标题最大长度" type="number" />
        <textarea className="min-h-28 rounded-md border border-line px-3 py-2" defaultValue="Best&#10;No.1&#10;Guaranteed&#10;Promo" placeholder="禁止词，每行一个" />
        <textarea className="min-h-28 rounded-md border border-line px-3 py-2" defaultValue="品牌不明确时不得自动添加品牌；健康产品不得添加治疗、治愈或疾病预防描述。" />
        <button className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white">保存规则</button>
      </div>
    </div>
  );
}
