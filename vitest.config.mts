import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  resolve: { alias: { "@": resolve("src") } },
  oxc: { jsx: { runtime: "automatic" } },
  test: { testTimeout: 20000 },
});
