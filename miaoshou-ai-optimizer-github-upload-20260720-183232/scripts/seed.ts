import { PrismaClient } from "@prisma/client";
import seed from "../prisma/seed-data.json";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({ where: { email: "admin@local.invalid" }, update: {}, create: { email: "admin@local.invalid", passwordHash: "bootstrap-required", name: "主账户", role: "ADMIN" } });
  await prisma.systemSetting.upsert({
    where: { userId_key: { userId: owner.id, key: "limits" } },
    update: {},
    create: {
      userId: owner.id,
      key: "limits",
      valueJson: {
        dailyCostLimit: 50,
        taskCostLimit: 10,
        maxProductsPerTask: 500,
        maxImagesPerProduct: 12,
        openaiConcurrency: 2,
        miaoshouConcurrency: 2
      }
    }
  });

  for (const item of seed.products) {
    await prisma.product.upsert({
      where: { userId_miaoshouProductId: { userId: owner.id, miaoshouProductId: item.miaoshouProductId } },
      update: {},
      create: {
        userId: owner.id,
        miaoshouProductId: item.miaoshouProductId,
        originalTitle: item.originalTitle,
        status: item.status as never,
        source: item.source,
        targetPlatform: item.targetPlatform,
        category: item.category,
        attributes: item.attributes,
        description: item.description,
        variants: {
          create: item.variants.map((variant) => ({ ...variant, rawData: variant }))
        },
        images: {
          create: item.images.map((image, sortOrder) => ({
            type: image.type as never,
            originalUrl: image.originalUrl,
            sortOrder
          }))
        }
      }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
