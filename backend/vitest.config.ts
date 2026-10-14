import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 20000,
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/equivalence/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/types/**"
      ],
      all: true,
      skipFull: false
    }
  }
});
