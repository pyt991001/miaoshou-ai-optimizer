export async function getCurrentUserId(): Promise<string | null> {
  return null;
}

export function requireSecondConfirmation(value: unknown): void {
  if (value !== true) {
    throw new Error("Second confirmation is required before publishing products");
  }
}
