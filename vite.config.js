import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" permet d'héberger le site dans n'importe quel dossier (GitHub Pages, Netlify…)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
