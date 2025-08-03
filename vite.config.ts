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
    },
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 4173,
    host: '0.0.0.0'
  }
})