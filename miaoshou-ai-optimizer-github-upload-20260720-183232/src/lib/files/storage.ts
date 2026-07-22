import fs from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/config/env";

export interface StoredFile {
  url: string;
  path: string;
  size: number;
}

export interface StorageDriver {
  put(buffer: Buffer, key: string, contentType: string): Promise<StoredFile>;
  exists(key: string): Promise<boolean>;
}

class LocalStorageDriver implements StorageDriver {
  async exists(key: string): Promise<boolean> {
    const env = getEnv();
    const fullPath = path.join(process.cwd(), env.LOCAL_STORAGE_DIR, key.replace(/^\//, ""));
    return fs.access(fullPath).then(() => true).catch(() => false);
  }

  async put(buffer: Buffer, key: string, _contentType: string): Promise<StoredFile> {
    const env = getEnv();
    const safeKey = key.replace(/^\//, "");
    const fullPath = path.join(process.cwd(), env.LOCAL_STORAGE_DIR, safeKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return {
      path: fullPath,
      url: `/api/files/${safeKey}`,
      size: buffer.byteLength
    };
  }
}

class S3StorageDriver implements StorageDriver {
  private client: S3Client;

  constructor() {
    const env = getEnv();
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined
    });
  }

  async exists(key: string): Promise<boolean> {
    const env = getEnv();
    if (!env.S3_BUCKET) throw new Error("S3_BUCKET is required for S3 storage");
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return true;
    } catch (error) {
      const status = typeof error === "object" && error && "$metadata" in error
        ? Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode)
        : 0;
      if (status === 404) return false;
      const name = typeof error === "object" && error && "name" in error ? String((error as { name?: unknown }).name) : "";
      if (["NotFound", "NoSuchKey"].includes(name)) return false;
      throw error;
    }
  }

  async put(buffer: Buffer, key: string, contentType: string): Promise<StoredFile> {
    const env = getEnv();
    if (!env.S3_BUCKET) throw new Error("S3_BUCKET is required for S3 storage");
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType
      })
    );
    const base = env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? env.S3_ENDPOINT?.replace(/\/$/, "") ?? `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`;
    return { path: key, url: `${base}/${key}`, size: buffer.byteLength };
  }
}

export function getStorageDriver(): StorageDriver {
  return getEnv().STORAGE_DRIVER === "s3" ? new S3StorageDriver() : new LocalStorageDriver();
}
