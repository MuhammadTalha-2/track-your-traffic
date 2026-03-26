import path from "node:path";
import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),

  // Forward-compatible: when Prisma 7 drops url/directUrl from schema,
  // this will already be in place.
  migrate: {
    url: process.env.DATABASE_URL!,
  },
});
