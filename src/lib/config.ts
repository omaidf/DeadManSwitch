import type { EnvConfig } from '../types'

/**
 * Custom error class for configuration validation failures.
 * 
 * Extends the standard Error class to provide specific error handling
 * for environment configuration issues. Helps distinguish config errors
 * from other types of application errors.
 */
class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * Validates if a string is a properly formatted URL.
 * 
 * Uses the built-in URL constructor to check if the provided
 * string can be parsed as a valid URL. This ensures RPC endpoints
 * and other URL-based configuration values are correctly formatted.
 * 
 * @param url - The string to validate as a URL
 * @returns True if the string is a valid URL, false otherwise
 */
function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validates if a string is a properly formatted Solana public key.
 * 
 * Checks that the string matches the expected format for Solana public keys:
 * - Base58 encoded
 * - Between 32-44 characters in length
 * - Contains only valid Base58 characters (excludes 0, O, I, l)
 * 
 * @param key - The string to validate as a Solana public key
 * @returns True if the string is a valid Solana public key format
 */
function validatePublicKey(key: string): boolean {
  // Basic validation for Solana public key (base58, 32-44 chars)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  return base58Regex.test(key)
}

/**
 * Retrieves and validates the application configuration from environment variables.
 * 
 * This function:
 * - Loads configuration values from Vite environment variables
 * - Applies default values for missing configurations
 * - Validates all configuration values against expected formats
 * - Throws ConfigError if any validation fails
 * - Provides warnings for non-devnet usage
 * 
 * Environment variables:
 * - VITE_SOLANA_NETWORK: Solana network (devnet/testnet/mainnet-beta)
 * - VITE_SOLANA_RPC_URL: RPC endpoint URL
 * - VITE_PROGRAM_ID: Dead Man's Switch program ID
 * - VITE_LIT_NETWORK: Lit Protocol network (datil-dev/datil-test/mainnet)
 * 
 * @returns Validated configuration object
 * @throws ConfigError if any configuration value is invalid
 */
export function getConfig(): EnvConfig {
  const config = {
    SOLANA_NETWORK: (import.meta.env.VITE_SOLANA_NETWORK || 'devnet') as EnvConfig['SOLANA_NETWORK'],
    SOLANA_RPC_URL: import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    PROGRAM_ID: import.meta.env.VITE_PROGRAM_ID || 'f9kTeCnUyNX3Pg43d7DtjNixVYHLBynCY5ukfXDXcrs',
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