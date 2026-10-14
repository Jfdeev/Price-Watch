import { defineConfig } from "vitest/config";
import { databaseUrlFor } from "./bench/support/databaseUrl";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 120000,
    hookTimeout: 120000,
    include: ["tests/equivalence/**/*.test.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.EQUIVALENCE_DATABASE_URL ?? databaseUrlFor("pricewatch_test"),
      PRISMA_QUERY_EVENTS: "1"
    }
  }
});
