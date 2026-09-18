import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Vercel static builder looks for output in `dist/`
    outDir: 'dist',
  },
  server: {
    // In local dev, forward /api/* to the FastAPI backend so you don't
    // need to change any fetch() URLs between dev and production.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})