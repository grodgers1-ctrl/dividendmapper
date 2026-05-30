import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/backtest/**/__tests__/**/*.test.ts"],
    testTimeout: 30_000,
    environment: "node",
  },
});
