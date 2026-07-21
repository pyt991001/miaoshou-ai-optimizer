import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createMiaoshouClient } from "@/lib/miaoshou/client";
import { readLocalProducts, importMiaoshouProductsLocally, clearLocalProducts } from "@/lib/products/local-store";
import { upsertMiaoshouProduct } from "@/lib/products/import";
import { requireUser } from "@/lib/auth/session";
import { runWithAccountConfig } from "@/lib/config/account-runtime";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const params = request.nextUrl.searchParams;
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("pageSize") ?? 20);
  const keyword = params.get("keyword") ?? undefined;
  const status = params.get("status") ?? undefined;
  try {
    const local = await prisma.product.findMany({
      where: {
        userId: user.id,
        originalTitle: keyword ? { contains: keyword, mode: "insensitive" } : undefined,
        processingStatus: status && status !== "ALL" ? (status as never) : undefined
      },
      include: { images: true, variants: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    const total = await prisma.product.count({ where: { userId: user.id } });
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
  const user = await requireUser();
  let result;
  try {
    result = await runWithAccountConfig(user.id, () => createMiaoshouClient().listProducts({ page: 1, pageSize: 50 }));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "MIAOSHOU_IMPORT_FAILED",
        message: `妙手接口调用失败：${errorMessage(error)}`
      },
      { status: 502 }
    );
  }

  if (!Array.isArray(result.products)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_MIAOSHOU_RESPONSE", message: "妙手接口返回格式不正确：缺少商品列表" },
      { status: 502 }
    );
  }

  try {
    const products = [];
    for (const item of result.products) {
      products.push(await upsertMiaoshouProduct(item, user.id));
    }
    return NextResponse.json({ ok: true, imported: products.length, available: result.total, products, storage: "database" });
  } catch (databaseError) {
    try {
      const products = await importMiaoshouProductsLocally(result.products);
      return NextResponse.json({
        ok: true,
        imported: products.length,
        available: result.total,
        products,
        storage: "local-file",
        warning: `数据库写入失败，已临时保存到本地文件：${errorMessage(databaseError)}`
      });
    } catch (localError) {
      return NextResponse.json(
        {
          ok: false,
          error: "PRODUCT_STORAGE_FAILED",
          message: `商品已从妙手读取，但数据库和本地临时存储均写入失败。数据库：${errorMessage(databaseError)}；本地存储：${errorMessage(localError)}`
        },
        { status: 500 }
      );
    }
  }
}

export async function DELETE() {
  const user = await requireUser();
  let deletedFromDatabase: number;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.processingTask.updateMany({
        where: { product: { userId: user.id } },
        data: { productId: null }
      });

      // Keep this order explicit. It also works with databases created before
      // all cascade-delete constraints were added to the Prisma schema.
      await tx.imageOptimization.deleteMany({ where: { image: { product: { userId: user.id } } } });
      await tx.titleOptimization.deleteMany({ where: { product: { userId: user.id } } });
      await tx.miaoshouSyncRecord.deleteMany({ where: { product: { userId: user.id } } });
      await tx.productImage.deleteMany({ where: { product: { userId: user.id } } });
      await tx.productVariant.deleteMany({ where: { product: { userId: user.id } } });
      return tx.product.deleteMany({ where: { userId: user.id } });
    });
    deletedFromDatabase = result.count;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "CLEAR_PRODUCTS_FAILED",
        message: `清空数据库商品失败：${errorMessage(error)}`
      },
      { status: 500 }
    );
  }

  try {
    await clearLocalProducts();
    return NextResponse.json({ ok: true, deletedFromDatabase, localStorageCleared: true });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      deletedFromDatabase,
      localStorageCleared: false,
      warning: `数据库商品已清空，但本地临时文件清理失败：${errorMessage(error)}`
    });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "未知错误";
}
