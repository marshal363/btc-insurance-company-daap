import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    // Optional: You might want to exclude clarity tests from this config
    // exclude: ['**/clarity/**'], 
  },
}); 