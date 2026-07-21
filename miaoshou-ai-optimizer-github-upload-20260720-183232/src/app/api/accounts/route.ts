import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ users });
  } catch (error) { return authError(error); }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { email?: string; password?: string; name?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) return NextResponse.json({ message: "请输入有效邮箱" }, { status: 400 });
    const user = await prisma.user.create({ data: { email, name: body.name?.trim() || null, passwordHash: await hashPassword(body.password ?? ""), role: "MEMBER" }, select: { id: true, email: true, name: true, role: true, active: true } });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ message: "该邮箱已经存在" }, { status: 409 });
    return authError(error);
  }
}

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  return NextResponse.json({ message: message === "FORBIDDEN" ? "仅主账户可以管理子账户" : "请先登录" }, { status: message === "FORBIDDEN" ? 403 : 401 });
}
