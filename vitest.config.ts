import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000, // 30s timeout for API calls
    hookTimeout: 30000,
    teardownTimeout: 10000,
    pool: "forks", // Use forks for better isolation
    poolOptions: {
      forks: {
        singleFork: true, // Avoid rate limiting
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "tests/"],
    },
  },
});
