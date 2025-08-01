import type { EnvConfig } from '../types'

class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function validatePublicKey(key: string): boolean {
  // Basic validation for Solana public key (base58, 32-44 chars)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  return base58Regex.test(key)
}

export function getConfig(): EnvConfig {
  const config = {
    SOLANA_NETWORK: (import.meta.env.VITE_SOLANA_NETWORK || 'devnet') as EnvConfig['SOLANA_NETWORK'],
    SOLANA_RPC_URL: import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    PROGRAM_ID: import.meta.env.VITE_PROGRAM_ID || '21Tkms6a8wJg5KoFTsogCqxTpP8EK2AJH8gYbA4GtFyB',
    LIT_NETWORK: (import.meta.env.VITE_LIT_NETWORK || 'datil-dev') as EnvConfig['LIT_NETWORK'],
  }

  // Validate configuration
  const errors: string[] = []

  if (!['devnet', 'testnet', 'mainnet-beta'].includes(config.SOLANA_NETWORK)) {
    errors.push('VITE_SOLANA_NETWORK must be one of: devnet, testnet, mainnet-beta')
  }

  // Add warning for non-devnet usage
  if (config.SOLANA_NETWORK !== 'devnet') {
    console.warn('⚠️ WARNING: This dApp is designed for Devnet testing. You are using:', config.SOLANA_NETWORK)
  }

  if (!validateUrl(config.SOLANA_RPC_URL)) {
    errors.push('VITE_SOLANA_RPC_URL must be a valid URL')
  }

  if (!validatePublicKey(config.PROGRAM_ID)) {
    errors.push('VITE_PROGRAM_ID must be a valid Solana public key')
  }

  if (!['datil-dev', 'datil-test', 'mainnet'].includes(config.LIT_NETWORK)) {
    errors.push('VITE_LIT_NETWORK must be one of: datil-dev, datil-test, mainnet')
  }

  if (errors.length > 0) {
    throw new ConfigError(`Configuration validation failed:\n${errors.join('\n')}`)
  }

  return config
}