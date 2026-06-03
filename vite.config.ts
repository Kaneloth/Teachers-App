import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// True only inside the Replit editor
const isReplit = process.env.REPL_ID !== undefined;

// PORT and BASE_PATH are injected by Replit workflows; on Netlify they are absent.
// Fall back to safe defaults so the Netlify build never throws here.
const port = process.env.PORT ? Number(process.env.PORT) : 5173;
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const supabaseAnonKey =
    env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";

  // All @replit/* plugins are loaded dynamically and ONLY in the Replit editor.
  // They are never installed on Netlify, so any static import would break the build.
  const replitPlugins = isReplit
    ? await Promise.all([
        import("@replit/vite-plugin-runtime-error-modal").then((m) =>
          m.default()
        ),
        ...(process.env.NODE_ENV !== "production"
          ? [
              import("@replit/vite-plugin-cartographer").then((m) =>
                m.cartographer({
                  root: path.resolve(import.meta.dirname, ".."),
                })
              ),
              import("@replit/vite-plugin-dev-banner").then((m) =>
                m.devBanner()
              ),
            ]
          : []),
      ])
    : [];

  return {
    base: basePath,
    define: {
      __SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
    },
    plugins: [react(), tailwindcss(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        // @assets is a Replit-specific path; omit it on Netlify to avoid
        // "directory does not exist" errors during the build.
        ...(isReplit && {
          "@assets": path.resolve(
            import.meta.dirname,
            "..",
            "..",
            "attached_assets"
          ),
        }),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: { strict: true },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
