const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react-swc");
const path = require("path");

// lovable-tagger is ESM-only and cannot be required() in CJS; skip it in this config
// https://vite.dev/guide/troubleshooting.html#this-package-is-esm-only

// https://vitejs.dev/config/
// CJS config avoids Node ESM path resolution bug when project path contains spaces (Windows)
module.exports = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
}));
