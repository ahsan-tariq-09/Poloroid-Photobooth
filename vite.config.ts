import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export default defineConfig({
  plugins: [react(), {
    name: "poloroid-offline",
    apply: "build",
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(name => /\.(js|css|wasm)$/.test(name)).map(name => "/" + name);
      const resources = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/sample-coast.webp", "/fonts/dm-serif-display/regular.ttf", "/fonts/dm-serif-display/italic.ttf", ...assets];
      resources.push("/fonts/lindbergh-baby/Lindbergh_Baby.ttf", "/sample-flash.webp", "/textures/leather.webp");
      resources.push("/fonts/caveat/Caveat.ttf", "/fonts/permanent-marker/PermanentMarker-Regular.ttf");
      const hash = createHash("sha256").update(JSON.stringify(resources)).update(readFileSync("index.html")).update(readFileSync("src/service-worker.js"));
      for (const path of resources.filter(path => path !== "/" && !path.startsWith("/assets/"))) hash.update(readFileSync("public" + path));
      const version = hash.digest("hex").slice(0,12);
      const source = readFileSync("src/service-worker.js", "utf8").replace("__CACHE_NAME__", `poloroid-${version}`).replace("__PRECACHE__", JSON.stringify(resources));
      this.emitFile({type: "asset", fileName: "sw.js", source});
    },
  }],
  // Discover lazy codecs before editing starts, avoiding a dev-only reload on first use.
  optimizeDeps: { include: ["elheif", "heic-to/csp"] },
});
