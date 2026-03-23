import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^three$/,
        replacement: fileURLToPath(
          new URL("./vendor/three/build/three.module.js", import.meta.url)
        ),
      },
      {
        find: /^three\/addons\/(.*)$/,
        replacement: fileURLToPath(
          new URL("./vendor/three/examples/jsm/$1", import.meta.url)
        ),
      },
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
