import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/** Build used for shared cPanel hosting: browser assets only, no Node server. */
export default defineConfig({
  root: path.resolve(__dirname, "static"),
  plugins: [react()],
  publicDir: path.resolve(__dirname, "public"),
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  build: {
    outDir: path.resolve(__dirname, "release/public"),
    emptyOutDir: true,
  },
});
