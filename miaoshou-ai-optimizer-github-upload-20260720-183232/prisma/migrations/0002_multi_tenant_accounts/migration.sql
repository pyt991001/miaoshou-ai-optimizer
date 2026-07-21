CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;

INSERT INTO "User" ("id", "email", "passwordHash", "name", "role", "active", "sessionVersion", "createdAt", "updatedAt")
VALUES ('legacy-admin', 'admin@local.invalid', 'bootstrap-required', '主账户', 'ADMIN', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;

ALTER TABLE "SystemSetting" ADD COLUMN "userId" TEXT;
ALTER TABLE "ApiCredential" ADD COLUMN "userId" TEXT;
ALTER TABLE "Product" ADD COLUMN "userId" TEXT;
ALTER TABLE "ProcessingJob" ADD COLUMN "userId" TEXT;
ALTER TABLE "ApiUsageRecord" ADD COLUMN "userId" TEXT;
ALTER TABLE "ErrorLog" ADD COLUMN "userId" TEXT;

UPDATE "SystemSetting" SET "userId" = 'legacy-admin' WHERE "userId" IS NULL;
UPDATE "ApiCredential" SET "userId" = 'legacy-admin' WHERE "userId" IS NULL;
UPDATE "Product" SET "userId" = 'legacy-admin' WHERE "userId" IS NULL;
UPDATE "ProcessingJob" SET "userId" = 'legacy-admin' WHERE "userId" IS NULL;
UPDATE "ApiUsageRecord" SET "userId" = 'legacy-admin' WHERE "userId" IS NULL;
UPDATE "ErrorLog" SET "userId" = 'legacy-admin' WHERE "userId" IS NULL;

ALTER TABLE "SystemSetting" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ApiCredential" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ProcessingJob" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ApiUsageRecord" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ErrorLog" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "SystemSetting" DROP CONSTRAINT IF EXISTS "SystemSetting_key_key";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_miaoshouProductId_key";

CREATE UNIQUE INDEX "SystemSetting_userId_key_key" ON "SystemSetting"("userId", "key");
CREATE UNIQUE INDEX "Product_userId_miaoshouProductId_key" ON "Product"("userId", "miaoshouProductId");
CREATE INDEX "SystemSetting_userId_idx" ON "SystemSetting"("userId");
CREATE INDEX "ApiCredential_userId_provider_active_idx" ON "ApiCredential"("userId", "provider", "active");
CREATE INDEX "Product_userId_updatedAt_idx" ON "Product"("userId", "updatedAt");
CREATE INDEX "ProcessingJob_userId_createdAt_idx" ON "ProcessingJob"("userId", "createdAt");
CREATE INDEX "ApiUsageRecord_userId_provider_createdAt_idx" ON "ApiUsageRecord"("userId", "provider", "createdAt");
CREATE INDEX "ErrorLog_userId_createdAt_idx" ON "ErrorLog"("userId", "createdAt");

ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiUsageRecord" ADD CONSTRAINT "ApiUsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
