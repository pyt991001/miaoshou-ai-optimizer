import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: true,
      images: { include: { optimizations: true }, orderBy: { sortOrder: "asc" } },
      titleOptimizations: { orderBy: { createdAt: "desc" } },
      syncRecords: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}
