import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, last4 } from "@/lib/crypto/secrets";

export async function GET() {
  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  const credentials = await prisma.apiCredential.findMany({
    select: { id: true, provider: true, name: true, active: true, last4: true, createdAt: true, updatedAt: true }
  });
  return NextResponse.json({ settings, credentials });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { provider: "OPENAI" | "MIAOSHOU"; name: string; payload: Record<string, string> };
  const secret = body.payload.apiKey ?? body.payload.accessToken ?? body.payload.appSecret;
  const credential = await prisma.apiCredential.create({
    data: {
      provider: body.provider,
      name: body.name,
      encryptedPayload: encryptSecret(body.payload),
      last4: last4(secret)
    },
    select: { id: true, provider: true, name: true, last4: true, active: true }
  });
  return NextResponse.json(credential);
}
