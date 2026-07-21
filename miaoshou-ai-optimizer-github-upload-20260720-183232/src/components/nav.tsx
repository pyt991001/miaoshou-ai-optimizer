import Link from "next/link";

const items = [
  ["商品", "/products"],
  ["新建任务", "/jobs/new"],
  ["任务进度", "/jobs"],
  ["图片规则", "/rules/images"],
  ["标题规则", "/rules/titles"],
  ["妙手配置", "/settings/miaoshou"],
  ["OpenAI 配置", "/settings/openai"],
  ["R2 图片存储", "/settings/storage"],
  ["子账户管理", "/accounts"],
  ["日志", "/logs"]
];

export function Nav() {
  return (
    <aside className="min-h-screen w-60 border-r border-line bg-white px-4 py-5">
      <Link href="/" className="block text-lg font-semibold text-ink">
        商品 AI 优化系统
      </Link>
      <nav className="mt-6 grid gap-1">
        {items.map(([label, href]) => (
          <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-cloud hover:text-ink">
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
