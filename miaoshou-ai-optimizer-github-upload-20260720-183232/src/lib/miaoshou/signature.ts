import crypto from "node:crypto";

export interface SignInput {
  path: string;
  timestamp: string;
  appKey: string;
  bodyJson?: string;
  appSecret: string;
}

export function createMiaoshouSignature(input: SignInput): string {
  const canonical = `${input.appSecret}${input.path}${input.timestamp}${input.appKey}${input.bodyJson ?? ""}${input.appSecret}`;
  return crypto.createHmac("sha256", input.appSecret).update(canonical).digest("hex");
}
