import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { runWithAccountConfig } from "@/lib/config/account-runtime";
import { createMiaoshouClient } from "@/lib/miaoshou/client";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  return runWithAccountConfig(user.id, async () => {
    const platform = request.nextUrl.searchParams.get("platform")?.trim() || "shein";
    const site = request.nextUrl.searchParams.get("site")?.trim() || undefined;
    try {
      const shops = await createMiaoshouClient().listShops(platform, site);
      return NextResponse.json({ platform, site: site ?? null, count: shops.length, shops });
    } catch (error) {
      console.error("[miaoshou-shops] read failed", {
        platform,
        site,
        message: error instanceof Error ? error.message : String(error)
      });
      return NextResponse.json(
        { error: "MIAOSHOU_SHOPS_FAILED", message: error instanceof Error ? error.message : "读取妙手店铺失败" },
        { status: 500 }
      );
    }
  });
}
