import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    include: ["evals/**/*.eval.ts"],
    globals: true,
    testTimeout: 30_000,
  },
});
