import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const isDev = process.env.NODE_ENV === "development";

// https://vite.dev/config/
export default defineConfig({
  base: isDev ? "/" : "/qwen-image-edit-ui/",
  plugins: [vue()],
  build: {
    outDir: "./docs",
  },
});
