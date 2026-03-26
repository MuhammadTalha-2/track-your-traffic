import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, beforeEach } from "vitest";

export const prisma = new PrismaClient();

// Test shop domains
export const SHOP_A = "shop-a-test.myshopify.com";
export const SHOP_B = "shop-b-test.myshopify.com";

beforeAll(async () => {
  // Ensure DB connection is alive
  await prisma.$connect();
});

beforeEach(async () => {
  // Clean up test data before each test
  await prisma.visit.deleteMany({
    where: { shop: { in: [SHOP_A, SHOP_B] } },
  });
  await prisma.campaign.deleteMany({
    where: { shop: { in: [SHOP_A, SHOP_B] } },
  });
  await prisma.setting.deleteMany({
    where: { shop: { in: [SHOP_A, SHOP_B] } },
  });
  await prisma.session.deleteMany({
    where: { shop: { in: [SHOP_A, SHOP_B] } },
  });
});

afterAll(async () => {
  // Final cleanup
  await prisma.visit.deleteMany({
    where: { shop: { in: [SHOP_A, SHOP_B] } },
  });
  await prisma.campaign.deleteMany({
    where: { shop: { in: [SHOP_A, SHOP_B] } },
  });
  await prisma.setting.deleteMany({
    where: { shop: { in: [SHOP_A, SHOP_B] } },
  });
  await prisma.session.deleteMany({
    where: { shop: { in: [SHOP_A, SHOP_B] } },
  });
  await prisma.$disconnect();
});
