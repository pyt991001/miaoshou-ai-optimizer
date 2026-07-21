import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || password.length < 10) return NextResponse.json({ message: "邮箱或密码格式不正确" }, { status: 400 });

  const env = getEnv();
  let user = await prisma.user.findUnique({ where: { email } });
  const isBootstrap = env.ADMIN_EMAIL?.toLowerCase() === email && env.ADMIN_PASSWORD === password;
  if (isBootstrap && (!user || user.passwordHash === "bootstrap-required")) {
    const passwordHash = await hashPassword(password);
    user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: "ADMIN", active: true, sessionVersion: { increment: 1 } },
      create: { email, passwordHash, name: "主账户", role: "ADMIN" }
    });
    if (user.id !== "legacy-admin") {
      await prisma.$transaction([
        prisma.systemSetting.updateMany({ where: { userId: "legacy-admin" }, data: { userId: user.id } }),
        prisma.apiCredential.updateMany({ where: { userId: "legacy-admin" }, data: { userId: user.id } }),
        prisma.product.updateMany({ where: { userId: "legacy-admin" }, data: { userId: user.id } }),
        prisma.processingJob.updateMany({ where: { userId: "legacy-admin" }, data: { userId: user.id } }),
        prisma.apiUsageRecord.updateMany({ where: { userId: "legacy-admin" }, data: { userId: user.id } }),
        prisma.errorLog.updateMany({ where: { userId: "legacy-admin" }, data: { userId: user.id } }),
        prisma.user.deleteMany({ where: { id: "legacy-admin" } })
      ]);
    }
  }
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) return NextResponse.json({ message: "邮箱或密码错误，或账户已停用" }, { status: 401 });
  await createSession(user);
  return NextResponse.json({ ok: true, user: { email: user.email, name: user.name, role: user.role } });
}
