import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'github-pages-spa-fallback',
      closeBundle() {
        const index = resolve(__dirname, 'dist/index.html')
        const fallback = resolve(__dirname, 'dist/404.html')
        if (existsSync(index)) copyFileSync(index, fallback)
      },
    },
  ],
  base: process.env.VITE_BASE_PATH || './',
  server: {
    proxy: {
      '/gemini-api': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gemini-api/, ''),
      },
    },
  },
})
