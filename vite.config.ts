/// <reference types="vitest" />
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The app lives under /app/ of heroquill.app; the welcome page and the legal pages are in site/.
export default defineConfig(() => {
  const base = "/app/";
  const name = "Heroquill";
  return {
    base,
    build: { outDir: "dist/app", emptyOutDir: true },
    plugins: [
      preact(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["icon.svg", "apple-touch-icon.png"],
        manifest: {
          // The identity of the installed app (and of its Microsoft Store package): the start_url it
          // always had, so the installs made before this field keep being the same app.
          id: base,
          name,
          short_name: name,
          description: "Create, print and play D&D 5e characters, online or offline.",
          start_url: base,
          scope: base,
          display: "standalone",
          background_color: "#17233b",
          theme_color: "#17233b",
          categories: ["games", "entertainment", "utilities"],
          // Opening the app again brings its window forward instead of a second one.
          launch_handler: { client_mode: "focus-existing" },
          // Shown by the browsers' install dialogs (and read by PWABuilder for the store packages).
          // Made from the dev server with a test character; not precached (no .webp in globPatterns).
          screenshots: [
            {
              src: "screenshots/wide-sheet.webp",
              sizes: "2160x1350",
              type: "image/webp",
              form_factor: "wide",
              label: "The character sheet",
            },
            {
              src: "screenshots/wide-play.webp",
              sizes: "2160x1350",
              type: "image/webp",
              form_factor: "wide",
              label: "Play: hit points, spell slots and rolls",
            },
            {
              src: "screenshots/narrow-play.webp",
              sizes: "780x1688",
              type: "image/webp",
              form_factor: "narrow",
              label: "Play on a phone",
            },
            {
              src: "screenshots/narrow-sheet.webp",
              sizes: "780x1688",
              type: "image/webp",
              form_factor: "narrow",
              label: "The character sheet on a phone",
            },
          ],
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
            { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          ],
        },
        workbox: {
          // The WOFF files are the fonts the fillable PDF embeds (a PDF cannot hold WOFF2), so that
          // it can be made offline too.
          globPatterns: ["**/*.{js,css,html,svg,json,woff2,woff}"],
        },
      }),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    },
  };
});
