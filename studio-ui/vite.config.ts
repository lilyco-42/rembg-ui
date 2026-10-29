import { defineConfig,loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({mode})=>({plugins:[react(),tailwindcss()],base:loadEnv(mode,process.cwd(),"").VITE_BROWSER_DEMO==="true"?"/rembg-studio-preview/":"/studio-ui/",build:{outDir:"../frontend/studio-ui",emptyOutDir:true},server:{proxy:{"/api":"http://127.0.0.1:8042"}}}));
