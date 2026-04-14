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
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"],
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
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
