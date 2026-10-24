import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base './' 让纯静态产物可以部署在任意子路径下
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
