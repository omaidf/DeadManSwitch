// Polyfills for Node.js globals in browser environment
import { Buffer } from 'buffer'
import process from 'process'

// Make Buffer globally available
;(window as any).Buffer = Buffer
;(globalThis as any).Buffer = Buffer

// Make process globally available
;(window as any).process = process
;(globalThis as any).process = process

// Ensure global is available
if (typeof (globalThis as any).global === 'undefined') {
  ;(globalThis as any).global = globalThis
}

export {}