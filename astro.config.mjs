import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: process.env.BASE_PATH ?? "",
  integrations: [svelte()],
  vite: {
    resolve: {
      alias: {
        $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
      },
    },
    build: {
      cssCodeSplit: false,
    },
  },
});
