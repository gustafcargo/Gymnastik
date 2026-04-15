/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Gymnastik-planeraren",
        short_name: "Gymnastik",
        description: "Planera gymnastikpass visuellt – dra och släpp redskap.",
        theme_color: "#2563EB",
        background_color: "#F8FAFB",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Ta kontroll direkt utan att vänta på nästa navigation.
        // Förhindrar att gamla cachade JS-chunk-filer serveras efter deploy.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"],
        // HTML: hämta alltid från nätverket först så index.html aldrig
        // serveras från cache med felaktiga chunk-hash-referenser.
        navigationPreload: false,
        runtimeCaching: [
          {
            urlPattern: /\/index\.html$/,
            handler: "NetworkFirst",
            options: { cacheName: "html-cache" },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          konva: ["konva", "react-konva", "use-image"],
          pdf: ["jspdf"],
          motion: ["framer-motion"],
          three: ["three", "@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
