import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    environment: "node",
    environmentMatchGlobs: [
      ["src/components/onboarding/**/*.test.{ts,tsx}", "jsdom"],
      ["tests/**/*.test.{ts,tsx}", "jsdom"],
    ],
    setupFiles: ["./tests/setup.ts"],
    typecheck: {
      tsconfig: "./tsconfig.json",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
