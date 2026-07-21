import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (id === admin.id) return NextResponse.json({ message: "不能在这里停用或重置当前主账户" }, { status: 400 });
    const body = (await request.json()) as { active?: boolean; password?: string; name?: string };
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(typeof body.active === "boolean" ? { active: body.active } : {}),
        ...(body.name !== undefined ? { name: body.name.trim() || null } : {}),
        ...(body.password ? { passwordHash: await hashPassword(body.password), sessionVersion: { increment: 1 } } : {}),
        ...(body.active === false ? { sessionVersion: { increment: 1 } } : {})
      },
      select: { id: true, email: true, name: true, role: true, active: true }
    });
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ message: message === "FORBIDDEN" ? "仅主账户可以管理子账户" : "操作失败" }, { status: message === "FORBIDDEN" ? 403 : 500 });
  }
}
