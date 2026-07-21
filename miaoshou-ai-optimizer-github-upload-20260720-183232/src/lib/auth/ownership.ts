import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export async function requireOwnedJob(id: string) {
  const user = await requireUser();
  const job = await prisma.processingJob.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!job) throw new Error("NOT_FOUND");
  return { user, job };
}
