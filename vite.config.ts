import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env.NODE_DEBUG': '""',
    'process.env.NODE_ENV': '"development"',
    'process.env.BROWSER': '"true"',
    'process.browser': 'true',
    'process.version': '""',
    'process.versions': '{}',
    'process.platform': '"browser"',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      process: 'process',
    },
  },
  optimizeDeps: {
    include: [
      'buffer',
      'process',
      'crypto-browserify',
      'stream-browserify',
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
    host: '0.0.0.0',
    open: true
  },
  preview: {
    port: 4173,
    host: '0.0.0.0'
  }
})