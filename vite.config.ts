import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "node20",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
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
        "undici",
      ],
      output: {
        format: "cjs",
        exports: "auto",
      },
    },

    // THIS IS THE IMPORTANT PART
    commonjsOptions: {
      include: [/node_modules/],
    },

    minify: false,
    sourcemap: true,
    outDir: "dist",
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
