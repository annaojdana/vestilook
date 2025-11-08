// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

const DEV_SERVER_PORT = Number.parseInt(process.env.VESTILOOK_DEV_PORT ?? process.env.PORT ?? "3000", 10);
const VITE_CONDITIONS = ["module-sync", "module", "browser", "import", "default"];
const VITE_SSR_CONDITIONS = ["module-sync", "module", "import", "node", "default"];

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  server: { port: Number.isFinite(DEV_SERVER_PORT) ? DEV_SERVER_PORT : 4321 },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      conditions: VITE_CONDITIONS,
    },
    optimizeDeps: {
      esbuildOptions: {
        conditions: [...VITE_CONDITIONS, "node"],
      },
    },
    ssr: {
      resolve: {
        conditions: VITE_SSR_CONDITIONS,
      },
    },
  },
  adapter: node({
    mode: "standalone",
  }),
});
