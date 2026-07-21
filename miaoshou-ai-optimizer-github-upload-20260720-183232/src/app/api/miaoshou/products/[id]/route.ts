import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await requireUser();
  const product = await prisma.product.findFirst({
    where: { id, userId: user.id },
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
