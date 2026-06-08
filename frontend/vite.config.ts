import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [react()],
  server: {
    port: 5307,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8402',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8402',
        ws: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8402',
        changeOrigin: true,
      },
    },
  },
})
