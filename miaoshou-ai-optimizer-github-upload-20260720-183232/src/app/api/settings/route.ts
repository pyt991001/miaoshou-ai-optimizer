import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, last4 } from "@/lib/crypto/secrets";
import { requireUser } from "@/lib/auth/session";

export async function GET() {
  const user = await requireUser();
  const settings = await prisma.systemSetting.findMany({ where: { userId: user.id }, orderBy: { key: "asc" } });
  const credentials = await prisma.apiCredential.findMany({
    where: { userId: user.id },
    select: { id: true, provider: true, name: true, active: true, last4: true, createdAt: true, updatedAt: true }
  });
  return NextResponse.json({ settings, credentials });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = (await request.json()) as { provider: "OPENAI" | "MIAOSHOU" | "STORAGE"; name: string; payload: Record<string, string> };
  const secret = body.payload.apiKey ?? body.payload.accessToken ?? body.payload.appSecret ?? body.payload.secretAccessKey;
  await prisma.apiCredential.updateMany({ where: { userId: user.id, provider: body.provider, active: true }, data: { active: false } });
  const credential = await prisma.apiCredential.create({
    data: {
      userId: user.id,
      provider: body.provider,
      name: body.name,
      encryptedPayload: encryptSecret(body.payload),
      last4: last4(secret)
    },
    select: { id: true, provider: true, name: true, last4: true, active: true }
  });
  return NextResponse.json(credential);
}
