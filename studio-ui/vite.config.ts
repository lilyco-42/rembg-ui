import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({plugins:[react(),tailwindcss()],base:"/studio-ui/",build:{outDir:"../frontend/studio-ui",emptyOutDir:true},server:{proxy:{"/api":"http://127.0.0.1:8042"}}});
