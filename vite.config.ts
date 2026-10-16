import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Discover lazy codecs before editing starts, avoiding a dev-only reload on first use.
  optimizeDeps: { include: ["elheif", "heic-to/csp"] },
});
