import { z } from "zod";

const safeImageUrl = z.string().url();
const allowedProtocols = new Set(["http:", "https:"]);
const privateHostPatterns = [/^localhost$/i, /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^169\.254\./, /^\[?::1\]?$/];

export function assertSafeImageUrl(input: string): URL {
  const parsed = new URL(safeImageUrl.parse(input));
  if (!allowedProtocols.has(parsed.protocol)) {
    throw new Error("Only http and https image URLs are allowed");
  }
  if (privateHostPatterns.some((pattern) => pattern.test(parsed.hostname))) {
    throw new Error("Private network image URLs are blocked to prevent SSRF");
  }
  return parsed;
}

export function assertAllowedImageMime(mime: string): void {
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(mime)) {
    throw new Error(`Unsupported image type: ${mime}`);
  }
}
