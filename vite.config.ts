import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "node24", // Matches action.yml
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["cjs"], // CommonJS for GitHub Actions
      fileName: "index",
    },
    rollupOptions: {
      external: [
        /^node:/,
        "node:sqlite", // Add this line
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
      ],
    },

    commonjsOptions: {
      include: [/node_modules/], // Bundle CJS dependencies
    },
  },
  esbuild: {
    target: "node24",
  },
  define: {
    global: "globalThis",
  },
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
