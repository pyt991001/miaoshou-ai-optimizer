import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "妙手商品 AI 优化系统",
  description: "Cross-border e-commerce product image and title optimizer"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
        <div className="flex min-h-screen">
          <Nav />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

const criticalCss = `
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:#f6f7f9;color:#172027;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif}
  a{color:inherit;text-decoration:none}
  button,input,select,textarea{font:inherit}
  button{cursor:pointer}
  table{border-collapse:collapse}
  .flex{display:flex}.grid{display:grid}.block{display:block}.hidden{display:none}.min-h-screen{min-height:100vh}.flex-1{flex:1 1 0%}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.items-start{align-items:flex-start}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.place-items-center{place-items:center}.text-left{text-align:left}.text-center{text-align:center}.text-right{text-align:right}.overflow-hidden{overflow:hidden}.min-w-0{min-width:0}.w-full{width:100%}.w-60{width:15rem}.w-56{width:14rem}.min-w-36{min-width:9rem}.size-2{width:.5rem;height:.5rem}.size-\\[54px\\]{width:54px;height:54px}.h-2{height:.5rem}.h-3{height:.75rem}.h-full{height:100%}.max-w-md{max-width:28rem}
  .space-y-1>:not([hidden])~:not([hidden]){margin-top:.25rem}.space-y-4>:not([hidden])~:not([hidden]){margin-top:1rem}.space-y-5>:not([hidden])~:not([hidden]){margin-top:1.25rem}.divide-y>:not([hidden])~:not([hidden]){border-top:1px solid #d8dee6}
  .gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}
  .mt-1{margin-top:.25rem}.mt-2{margin-top:.5rem}.mt-3{margin-top:.75rem}.mt-6{margin-top:1.5rem}.mb-1{margin-bottom:.25rem}.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.mr-1{margin-right:.25rem}.p-2{padding:.5rem}.p-3{padding:.75rem}.p-4{padding:1rem}.p-6{padding:1.5rem}.px-1\\.5{padding-left:.375rem;padding-right:.375rem}.px-2{padding-left:.5rem;padding-right:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-4{padding-left:1rem;padding-right:1rem}.py-0\\.5{padding-top:.125rem;padding-bottom:.125rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.px-4.py-5{padding:1.25rem 1rem}
  .border{border:1px solid #d8dee6}.border-t{border-top:1px solid #d8dee6}.border-b{border-bottom:1px solid #d8dee6}.border-r{border-right:1px solid #d8dee6}.border-dashed{border-style:dashed}.border-line{border-color:#d8dee6}.border-accent{border-color:#0f766e}.border-emerald-200{border-color:#a7f3d0}.border-blue-200{border-color:#bfdbfe}.border-red-200{border-color:#fecaca}.border-amber-200{border-color:#fde68a}
  .rounded{border-radius:.25rem}.rounded-md{border-radius:.5rem}.rounded-full{border-radius:9999px}
  .bg-white{background:#fff}.bg-cloud{background:#f6f7f9}.bg-slate-50{background:#f8fafc}.bg-slate-100{background:#f1f5f9}.bg-slate-700{background:#334155}.bg-emerald-50{background:#ecfdf5}.bg-emerald-500{background:#10b981}.bg-blue-50{background:#eff6ff}.bg-blue-500{background:#3b82f6}.bg-amber-50{background:#fffbeb}.bg-red-50{background:#fef2f2}.bg-red-500{background:#ef4444}.bg-indigo-50{background:#eef2ff}.bg-violet-50{background:#f5f3ff}.bg-cyan-50{background:#ecfeff}.bg-accent{background:#0f766e}
  .text-white{color:#fff}.text-ink{color:#172027}.text-slate-400{color:#94a3b8}.text-slate-500{color:#64748b}.text-slate-600{color:#475569}.text-slate-700{color:#334155}.text-slate-900{color:#0f172a}.text-emerald-700{color:#047857}.text-blue-700{color:#1d4ed8}.text-amber-700{color:#a16207}.text-red-700{color:#b91c1c}.text-indigo-700{color:#4338ca}.text-violet-700{color:#6d28d9}.text-cyan-700{color:#0e7490}.hover\\:text-accent:hover{color:#0f766e}.hover\\:bg-cloud:hover{background:#f6f7f9}.hover\\:border-accent:hover{border-color:#0f766e}
  .text-\\[10px\\]{font-size:10px}.text-xs{font-size:.75rem;line-height:1rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-2xl{font-size:1.5rem;line-height:2rem}.font-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}.font-medium{font-weight:500}.font-semibold{font-weight:600}
  .panel{border:1px solid #d8dee6;background:#fff;border-radius:.75rem;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .object-cover{object-fit:cover}.line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.transition-all{transition:all .2s ease}.disabled\\:opacity-50:disabled{opacity:.5;cursor:not-allowed}
  @media (min-width:768px){.md\\:grid-cols-5{grid-template-columns:repeat(5,minmax(0,1fr))}.sm\\:w-56{width:14rem}}
  .grid-cols-5{grid-template-columns:repeat(5,minmax(0,1fr))}
`;
