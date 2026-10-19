import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 앱 코드와 같은 "@/..." 경로를 테스트에서도 쓰도록 (tsconfig paths 와 같게)
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
