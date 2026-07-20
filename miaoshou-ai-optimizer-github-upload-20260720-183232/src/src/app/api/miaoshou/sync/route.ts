import { NextRequest, NextResponse } from "next/server";
import { SaveMode } from "@prisma/client";
import { saveLocalProductToMiaoshou, saveProductToMiaoshou } from "@/lib/miaoshou/sync";
import { updateLocalProductStatus } from "@/lib/products/local-store";

export async function POST(request: NextRequest) {
  let body: { productId: string; saveMode?: SaveMode } | null = null;
  try {
    body = (await request.json()) as { productId: string; saveMode?: SaveMode };
    if (body.productId.startsWith("local-")) await updateLocalProductStatus(body.productId, "SAVING_TO_MIAOSHOU");
    const record = body.productId.startsWith("local-")
      ? await saveLocalProductToMiaoshou(body.productId, body.saveMode ?? SaveMode.LOCAL_ONLY)
      : await saveProductToMiaoshou(body.productId, body.saveMode ?? SaveMode.LOCAL_ONLY);
    if (body.productId.startsWith("local-")) await updateLocalProductStatus(body.productId, "COMPLETED");
    return NextResponse.json(record);
  } catch (error) {
    if (body?.productId.startsWith("local-")) {
      await updateLocalProductStatus(body.productId, "FAILED", error instanceof Error ? error.message : "保存到妙手失败").catch(() => null);
    }
    return NextResponse.json(
      {
        error: "MIAOSHOU_SYNC_FAILED",
        message: error instanceof Error ? error.message : "保存到妙手失败"
      },
      { status: 500 }
    );
  }
}
