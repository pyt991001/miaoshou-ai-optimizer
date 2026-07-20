import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function prepareImageForOpenAI(input: { imageUrl: string; productId: string; imageId: string }): Promise<string> {
  let buffer: Buffer;

  if (input.imageUrl.startsWith("/api/files/")) {
    const relative = input.imageUrl.replace(/^\/api\/files\//, "");
    buffer = await fs.readFile(path.join(process.cwd(), "storage", relative));
  } else if (input.imageUrl.startsWith("/")) {
    buffer = await fs.readFile(path.join(process.cwd(), "public", input.imageUrl));
  } else {
    const response = await fetch(input.imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`下载原图失败：${response.status} ${response.statusText}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
  }

  const normalized = await sharp(buffer).rotate().png().toBuffer();
  const dir = path.join(process.cwd(), "storage", "originals", safeFileName(input.productId));
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${safeFileName(input.imageId)}.png`);
  await fs.writeFile(filePath, normalized);
  return filePath;
}
