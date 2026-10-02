import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 計算・データ処理の単体テスト（画面の操作テストは Playwright: e2e/）
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
