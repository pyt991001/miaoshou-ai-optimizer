import sharp from "sharp";

export interface ImageValidationResult {
  score: number;
  passed: boolean;
  needsReview: boolean;
  reasons: string[];
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    size: number;
  };
}

export async function validateOptimizedImage(input: {
  originalPath?: string;
  optimizedBuffer: Buffer;
  expectedFormat: string;
  title: string;
}): Promise<ImageValidationResult> {
  const reasons: string[] = [];
  if (!input.optimizedBuffer.byteLength) reasons.push("Output image is empty");
  const metadata = await sharp(input.optimizedBuffer).metadata();
  if (!metadata.width || !metadata.height) reasons.push("Image dimensions could not be read");
  if (input.expectedFormat !== "auto" && metadata.format && metadata.format !== input.expectedFormat) {
    reasons.push(`Expected ${input.expectedFormat}, got ${metadata.format}`);
  }
  if (input.optimizedBuffer.byteLength > 10 * 1024 * 1024) reasons.push("Image exceeds 10 MB");
  if (metadata.width && metadata.height && Math.min(metadata.width, metadata.height) < 512) {
    reasons.push("Image resolution is lower than recommended");
  }

  reasons.push("Vision consistency check skipped");
  const penalty = reasons.filter((reason) => !/Vision consistency check skipped|Vision check not run/i.test(reason)).length * 8;
  const score = Math.max(0, Math.min(100, 96 - penalty));
  return {
    score,
    passed: score >= 90,
    needsReview: score >= 75 && score < 90,
    reasons,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: input.optimizedBuffer.byteLength
    }
  };
}
