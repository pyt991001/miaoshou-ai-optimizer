export async function safeQuery<T>(query: () => Promise<T>, fallback: T, scope: string): Promise<T> {
  try {
    return await query();
  } catch (error) {
    console.warn(`[${scope}] Database query failed; rendering fallback UI`, error);
    return fallback;
  }
}
