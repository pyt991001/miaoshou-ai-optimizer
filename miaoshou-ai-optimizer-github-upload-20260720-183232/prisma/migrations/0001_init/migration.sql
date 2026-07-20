-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'FETCHING', 'DOWNLOADING', 'OPTIMIZING_TITLE', 'PROCESSING_IMAGES', 'VALIDATING', 'WAITING_REVIEW', 'SAVING_TO_MIAOSHOU', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductImageType" AS ENUM ('MAIN_IMAGE', 'GALLERY_IMAGE', 'SKU_IMAGE', 'DETAIL_IMAGE');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FETCH_PRODUCT', 'OPTIMIZE_TITLE', 'OPTIMIZE_IMAGE', 'VALIDATE_IMAGE', 'SAVE_TO_MIAOSHOU', 'PUBLISH_PRODUCT');

-- CreateEnum
CREATE TYPE "SaveMode" AS ENUM ('LOCAL_ONLY', 'PUBLIC_COLLECTION_BOX', 'PLATFORM_COLLECTION_BOX');

-- CreateEnum
CREATE TYPE "ApiProvider" AS ENUM ('OPENAI', 'MIAOSHOU', 'STORAGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL,
    "provider" "ApiProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "last4" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "miaoshouProductId" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "optimizedTitle" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'UNKNOWN',
    "source" TEXT NOT NULL,
    "targetPlatform" TEXT NOT NULL,
    "category" TEXT,
    "attributes" JSONB NOT NULL,
    "description" TEXT,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT,
    "color" TEXT,
    "size" TEXT,
    "imageUrl" TEXT,
    "rawData" JSONB NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "ProductImageType" NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "localPath" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "saveMode" "SaveMode" NOT NULL DEFAULT 'LOCAL_ONLY',
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL,
    "pauseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingTask" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "productId" TEXT,
    "type" "TaskType" NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitleOptimization" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "optimizedTitle" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "keywords" TEXT[],
    "removedTerms" TEXT[],
    "warnings" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "openaiRequestId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "decision" "ReviewDecision" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TitleOptimization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageOptimization" (
    "id" TEXT NOT NULL,
    "productImageId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "optimizedUrl" TEXT,
    "optimizedLocalPath" TEXT,
    "openaiRequestId" TEXT,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageType" "ProductImageType" NOT NULL,
    "processingMs" INTEGER,
    "apiCostUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "consistencyScore" INTEGER,
    "validationReport" JSONB,
    "failureReason" TEXT,
    "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "decision" "ReviewDecision" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageOptimization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiaoshouSyncRecord" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "saveMode" "SaveMode" NOT NULL,
    "miaoshouProductId" TEXT,
    "miaoshouTaskId" TEXT,
    "requestPayload" JSONB NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiaoshouSyncRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsageRecord" (
    "id" TEXT NOT NULL,
    "provider" "ApiProvider" NOT NULL,
    "operation" TEXT NOT NULL,
    "productId" TEXT,
    "jobId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "code" TEXT,
    "message" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "ApiCredential_provider_active_idx" ON "ApiCredential"("provider", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Product_miaoshouProductId_key" ON "Product"("miaoshouProductId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_type_idx" ON "ProductImage"("productId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingTask_idempotencyKey_key" ON "ProcessingTask"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProcessingTask_jobId_status_idx" ON "ProcessingTask"("jobId", "status");

-- CreateIndex
CREATE INDEX "ApiUsageRecord_provider_createdAt_idx" ON "ApiUsageRecord"("provider", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingTask" ADD CONSTRAINT "ProcessingTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProcessingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingTask" ADD CONSTRAINT "ProcessingTask_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleOptimization" ADD CONSTRAINT "TitleOptimization_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageOptimization" ADD CONSTRAINT "ImageOptimization_productImageId_fkey" FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiaoshouSyncRecord" ADD CONSTRAINT "MiaoshouSyncRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

