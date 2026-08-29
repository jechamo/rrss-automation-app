import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "src/components/**/*.test.tsx",
      "src/core/health/**/*.test.ts",
      "src/core/media/bintools-path.test.ts",
      "src/core/secrets/**/*.test.ts",
      "src/core/runtime/**/*.test.ts",
      "src/core/runtime/**/*.test.mjs",
      "src/core/ai/mock-engine.test.ts",
      "src/core/testing/**/*.test.ts",
      "scripts/e2e-gate.test.mjs",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
