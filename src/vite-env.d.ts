/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_NETWORK: string
  readonly VITE_SOLANA_RPC_URL: string
  readonly VITE_PROGRAM_ID: string
  readonly VITE_LIT_NETWORK: string
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}