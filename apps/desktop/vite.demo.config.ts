import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@tauri-apps/api/core": fileURLToPath(new URL("./demo/mockTauriCore.ts", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../../site/demo", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
