import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "node20",
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["cjs"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        // Only Node built-ins remain external
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
      ],
      output: {
        format: "cjs",
        exports: "auto",
      },
    },
    commonjsOptions: {
      include: [/node_modules/], // Bundle all CJS dependencies
    },
  },
  esbuild: {
    target: "node20",
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
