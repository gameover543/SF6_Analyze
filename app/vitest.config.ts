import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Node.js環境（APIルート・サーバーサイドロジックのテスト用）
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      // tsconfig の @/* と合わせる
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
