import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createMiaoshouClient } from "@/lib/miaoshou/client";
import { readLocalProducts, importMiaoshouProductsLocally, clearLocalProducts } from "@/lib/products/local-store";
import { upsertMiaoshouProduct } from "@/lib/products/import";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("pageSize") ?? 20);
  const keyword = params.get("keyword") ?? undefined;
  const status = params.get("status") ?? undefined;
  try {
    const local = await prisma.product.findMany({
      where: {
        originalTitle: keyword ? { contains: keyword, mode: "insensitive" } : undefined,
        processingStatus: status && status !== "ALL" ? (status as never) : undefined
      },
      include: { images: true, variants: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    const total = await prisma.product.count();
    return NextResponse.json({ products: local, page, pageSize, total, storage: "database" });
  } catch {
    const products = await readLocalProducts();
    const filtered = products.filter((product) => {
      const matchesKeyword = !keyword || product.originalTitle.toLowerCase().includes(keyword.toLowerCase()) || product.miaoshouProductId.includes(keyword);
      const matchesStatus = !status || status === "ALL" || product.processingStatus === status;
      return matchesKeyword && matchesStatus;
    });
    return NextResponse.json({
      products: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: filtered.length,
      storage: "local-file"
    });
  }
}

export async function POST() {
  const client = createMiaoshouClient();
  const result = await client.listProducts({ page: 1, pageSize: 50 }).catch((error) => {
    throw new Error(error instanceof Error ? `妙手接口调用失败：${error.message}` : "妙手接口调用失败");
  });
  try {
    const products = [];
    for (const item of result.products) {
      products.push(await upsertMiaoshouProduct(item));
    }
    return NextResponse.json({ imported: products.length, products, storage: "database" });
  } catch (error) {
    const products = await importMiaoshouProductsLocally(result.products);
    return NextResponse.json({
      imported: products.length,
      products,
      storage: "local-file",
      message: error instanceof Error ? `数据库不可用，已保存到本地文件：${error.message}` : "数据库不可用，已保存到本地文件"
    });
  }
}

export async function DELETE() {
  await clearLocalProducts();
  let deletedFromDatabase = 0;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.processingTask.updateMany({
        where: { productId: { not: null } },
        data: { productId: null }
      });
      return tx.product.deleteMany();
    });
    deletedFromDatabase = result.count;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? `清空商品失败：${error.message}` : "清空商品失败"
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, deletedFromDatabase });
}
