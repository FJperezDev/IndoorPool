import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expone el servidor al exterior del contenedor
    port: 5173,
    watch: {
      usePolling: true, // Esencial para el hot-reload en volúmenes Docker
    },
  },
});
