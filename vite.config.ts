import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': 'import.meta.env'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      'buffer',
      'process/browser',
    ],
    exclude: [
      'fs'
    ]
  },
  build: {
    rollupOptions: {
      external: ['fs', 'net', 'tls'],
    }
  },
  server: {
    port: 3000,
    open: true
  }
})