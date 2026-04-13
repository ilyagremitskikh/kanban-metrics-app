import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy all /webhook/* requests to n8n — avoids CORS in local dev
      '/webhook': {
        target: process.env.N8N_HOST || 'https://n8n.mindhackerdev.ru',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
