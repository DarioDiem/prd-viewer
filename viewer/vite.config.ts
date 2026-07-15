import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, searchForWorkspaceRoot } from "vite";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    fs: {
      allow: [repoRoot, searchForWorkspaceRoot(process.cwd())]
    }
  }
});
