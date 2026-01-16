import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "node20", // Matches your action.yml runtime
    outDir: "dist", // Output directory
    emptyOutDir: true, // Clear previous builds
    minify: false, // Keep readable for debugging
    sourcemap: true, // Optional: useful for debugging
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["cjs"], // Use CommonJS
      fileName: "index",
    },
    rollupOptions: {
      // Only Node built-ins remain external
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
      ],
      output: {
        format: "cjs",
        exports: "auto",
      },
    },
    commonjsOptions: {
      include: [/node_modules/], // Ensure CJS dependencies are bundled
    },
  },
  esbuild: {
    target: "node20", // Makes TypeScript compatible with Node 20
  },
  define: {
    global: "globalThis", // Required for Node environment
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
