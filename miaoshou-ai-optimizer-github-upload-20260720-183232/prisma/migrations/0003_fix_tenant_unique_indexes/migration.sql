-- Prisma creates PostgreSQL @unique declarations as unique indexes. The
-- previous migration attempted to drop them as table constraints, leaving
-- the legacy global uniqueness rules active.
DROP INDEX IF EXISTS "SystemSetting_key_key";
DROP INDEX IF EXISTS "Product_miaoshouProductId_key";
