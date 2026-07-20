"use client";

import { useState } from "react";

export function SettingsForm({ provider }: { provider: "OPENAI" | "MIAOSHOU" }) {
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="panel grid max-w-2xl gap-3 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const payload = Object.fromEntries(form.entries());
        await fetch("/api/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider, name: `${provider} credentials`, payload })
        });
        setSaved(true);
      }}
    >
      {provider === "OPENAI" ? (
        <>
          <input name="apiKey" className="rounded-md border border-line px-3 py-2" placeholder="OPENAI_API_KEY" type="password" />
          <input name="baseUrl" className="rounded-md border border-line px-3 py-2" placeholder="OPENAI_BASE_URL，中转站接口地址，例如 https://xxx/v1" />
          <input name="textModel" className="rounded-md border border-line px-3 py-2" placeholder="OPENAI_TEXT_MODEL，例如 gpt-4.1-mini" />
          <input name="imageModel" className="rounded-md border border-line px-3 py-2" placeholder="OPENAI_IMAGE_MODEL，例如 gpt-image-2" />
        </>
      ) : (
        <>
          <input name="baseUrl" className="rounded-md border border-line px-3 py-2" placeholder="MIAOSHOU_API_BASE_URL" />
          <input name="appKey" className="rounded-md border border-line px-3 py-2" placeholder="MIAOSHOU_APP_KEY" />
          <input name="appSecret" className="rounded-md border border-line px-3 py-2" placeholder="MIAOSHOU_APP_SECRET" type="password" />
          <input name="shopId" className="rounded-md border border-line px-3 py-2" placeholder="MIAOSHOU_SHOP_ID，发布时必填" />
          <input name="targetPlatform" className="rounded-md border border-line px-3 py-2" placeholder="MIAOSHOU_TARGET_PLATFORM：public" />
          <input name="targetBox" className="rounded-md border border-line px-3 py-2" placeholder="MIAOSHOU_TARGET_BOX：public" />
          <input name="targetSite" className="rounded-md border border-line px-3 py-2" placeholder="MIAOSHOU_TARGET_SITE，可选" />
        </>
      )}
      <button className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white">加密保存</button>
      {saved ? <div className="text-sm text-accent">已保存，密钥不会返回浏览器。</div> : null}
    </form>
  );
}
