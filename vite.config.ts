import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react()],
    // ✅ SECURITY FIX: Removed API key embedding from bundle
    // API keys are now handled securely by:
    // - Backend: /api/groq-proxy.ts for Groq API calls
    // - Vercel environment variables (never exposed to client)
    define: {
      // No API keys in client bundle!
      // These are only available server-side on Vercel
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
