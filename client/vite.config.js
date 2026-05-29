import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { imagetools } from "vite-imagetools";
import { VitePWA } from "vite-plugin-pwa";

/**
 * @param {string} mode
 * @param {Record<string, string>} env
 */
function resolveBase(mode, env) {
  if (env.VITE_CAPACITOR === "true") return "./";
  const explicit = env.VITE_APP_BASE?.trim();
  if (explicit) {
    return explicit.endsWith("/") ? explicit : `${explicit}/`;
  }
  /** Root `/` avoids blank pages when the built app is hosted at the domain root. Subpath deploys: set `VITE_APP_BASE`. */
  return mode === "production" ? "/" : "/";
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = resolveBase(mode, env);

  return {
    plugins: [
      imagetools(),
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "pwa-192.png", "pwa-512.png", "splash-logo.png"],
        manifest: {
          name: "LinkMart",
          short_name: "LinkMart",
          description: "Community marketplace — browse, sell, and buy with your neighbors.",
          theme_color: "#0f172a",
          background_color: "#ffffff",
          display: "standalone",
          /** Allow rotation when installed — landscape QA and keyboard docks (mobile-first, not portrait-locked). */
          orientation: "any",
          scope: base,
          start_url: base,
          categories: ["shopping", "social"],
          icons: [
            {
              src: "pwa-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,avif,woff2}"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api",
                expiration: {
                  maxEntries: 32,
                  maxAgeSeconds: 120,
                },
                networkTimeoutSeconds: 8,
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    base,
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
            return "vendor";
          },
        },
      },
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
  };
});
