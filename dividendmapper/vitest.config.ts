import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    coverage: { provider: "v8", reporter: ["text"] },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
