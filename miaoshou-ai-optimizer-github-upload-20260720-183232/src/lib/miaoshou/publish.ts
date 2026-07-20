import { requireSecondConfirmation } from "@/lib/auth/session";
import { createMiaoshouClient } from "@/lib/miaoshou/client";

export async function publishWithConfirmation(productId: string, confirmed: boolean, idempotencyKey: string) {
  requireSecondConfirmation(confirmed);
  return createMiaoshouClient().publishProduct(productId, idempotencyKey);
}
