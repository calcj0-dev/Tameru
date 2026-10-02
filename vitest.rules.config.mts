import { defineConfig } from "vitest/config";

// Firestore セキュリティルールのテスト（エミュレーターが必要。npm run test:e2e:sync から実行）
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
