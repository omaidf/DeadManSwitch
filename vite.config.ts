import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env.NODE_DEBUG': '""',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.BROWSER': '"true"',
    'process.browser': 'true',
    'process.version': '""',
    'process.versions': '{}',
    'process.platform': '"browser"',
    // Make Buffer globally available
    'global.Buffer': 'Buffer',
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
      '@lit-protocol/lit-node-client',
      '@lit-protocol/encryption',
      '@solana/web3.js',
      'bs58'
    ],
    exclude: [
      'fs'
    ]
  },
  build: {
    rollupOptions: {
      external: ['fs', 'net', 'tls'],
      output: {
        globals: {
          buffer: 'Buffer',
        }
      }
    },
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure polyfills are properly included
    commonjsOptions: {
      transformMixedEsModules: true,
    }
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