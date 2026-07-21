import { NextRequest, NextResponse } from "next/server";
import { optimizeTitle } from "@/lib/openai/title-service";
import { requireUser } from "@/lib/auth/session";
import { runWithAccountConfig } from "@/lib/config/account-runtime";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json();
  const result = await runWithAccountConfig(user.id, () => optimizeTitle(body));
  return NextResponse.json(result);
}
