import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

const prismaOptions = {
  datasourceUrl: process.env.DATABASE_URL,
};

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient(prismaOptions);
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient(prismaOptions);

export default prisma;
