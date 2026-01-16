import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    // GitHub Actions need to be in Node.js format, not browser
    target: "node20",
    lib: {
      // Entry point is our TypeScript file
      entry: resolve(__dirname, "src/index.ts"),
      // Single bundle for GitHub Action
      formats: ["cjs"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        /^node:/,
        "fs",
        "path",
        "child_process",
        "os",
        "crypto",
        "stream",
        "events",
        "util",
        "timers",
        "assert",
        "http",
        "https",
        "net",
        "tls",
        "zlib",
        "buffer",
        "querystring",

        // Critical: do not bundle GitHub Actions or undici
        /^@actions\//,
        "undici",
      ],
      output: {
        format: "cjs",
        manualChunks: undefined,
      },
    },
    // Output directory
    outDir: "dist",
    // Don't minify for better debugging in GitHub Actions
    minify: false,
    // Generate source maps for debugging
    sourcemap: true,
    // Clear output directory
    emptyOutDir: true,
  },
  // Ensure we can import TypeScript files
  esbuild: {
    target: "node20",
  },
  // Define globals for Node.js environment
  define: {
    global: "globalThis",
  },
  // Vitest configuration
  test: {
    environment: "node",
    clearMocks: true,
    include: ["src/**/*.{test,spec}.{js,ts}"],
    coverage: {
      include: ["src/**/*.{js,ts}"],
      exclude: ["src/**/*.{test,spec}.{js,ts}"],
    },
  },
});
