import {defineConfig, loadEnv} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), "");
  const browserDemo = env.VITE_BROWSER_DEMO === "true";
  if (browserDemo && env.REMBG_EDITION !== "community") {
    throw new Error("Standalone browser inference must be built explicitly for Community edition");
  }
  return {
    plugins: [react(), tailwindcss()],
    base: browserDemo ? "/rembg-studio-preview/" : "/studio-ui/",
    build: {outDir: "../frontend/studio-ui", emptyOutDir: true},
    server: {proxy: {"/api": "http://127.0.0.1:8042"}}
  };
});
