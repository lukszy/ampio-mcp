import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(({ command }) => ({
  // Build configuration
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "MCPTypescriptTemplate",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "@modelcontextprotocol/sdk",
        "@modelcontextprotocol/sdk/server/mcp.js",
        "@modelcontextprotocol/sdk/server/streamableHttp.js",
        "@modelcontextprotocol/sdk/types.js",
        "express",
        "zod",
        "node:crypto",
        "node:http",
        "node:path",
        "node:fs",
        "node:url",
        "node:buffer",
        "node:stream",
        "node:events",
        "node:util",
        "crypto",
        "http",
        "path",
        "fs",
        "url",
        "buffer",
        "stream",
        "events",
        "util",
      ],
      output: {
        format: "es",
      },
    },
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    ssr: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  ssr: {
    external: ["@modelcontextprotocol/sdk", "express", "zod"],
  },
  test: {
    // Mandatory AMPIO_* env vars need valid values in every test run
    env: {
      AMPIO_URL: "192.168.1.100",
      AMPIO_PORT: "8060",
      AMPIO_LOGIN: "admin",
      AMPIO_PASSWORD: "secret",
      LOG_LEVEL: "error",
    },
  },
}));
