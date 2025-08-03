import { PublicKey } from '@solana/web3.js'

// Environment configuration
export interface EnvConfig {
  SOLANA_NETWORK: 'devnet' | 'testnet' | 'mainnet-beta'
  SOLANA_RPC_URL: string
  PROGRAM_ID: string
  LIT_NETWORK: 'datil-dev' | 'datil-test' | 'mainnet'
}

// Dead Man's Switch account structure (matches deployed contract)
export interface DeadManSwitch {
  owner: PublicKey
  lastPing: number | bigint  // Can be bigint from Anchor deserialization
  pingInterval: number | bigint  // Can be bigint from Anchor deserialization  
  encryptedData: number[]  // Fixed array [u8; 512] comes as number array from Anchor
  dataLength: number      // u16 field tracking actual data size
  createdAt: number | bigint  // Can be bigint from Anchor deserialization
  bump: number           // u8 PDA bump
  expired: boolean       // Boolean flag indicating if switch is marked as expired
}

// Switch info structure (matches IDL)
export interface SwitchInfo {
  owner: PublicKey
  expired: boolean
  lastPing: number | bigint  // Can be bigint from Anchor deserialization
  pingInterval: number | bigint  // Can be bigint from Anchor deserialization
  createdAt: number | bigint  // Can be bigint from Anchor deserialization
  expirationTime: number | bigint  // Can be bigint from Anchor deserialization
  currentTime: number | bigint  // Can be bigint from Anchor deserialization
}

// Switch creation form data
export interface SwitchFormData {
  message: string
  interval: number // in seconds
}

// Network status
export interface NetworkStatus {
  isConnected: boolean
  network: string
  rpcUrl: string
  slot: number | null
}

// Wallet connection state
export interface WalletState {
  connected: boolean
  connecting: boolean
  publicKey: PublicKey | null
  error: string | null
}

// Program events (matches IDL)
export interface SwitchCreatedEvent {
  switch: PublicKey
  owner: PublicKey
  switchId: number
  pingInterval: number
  expirationTime: number
  timestamp: number
}

export interface SwitchPingedEvent {
  owner: PublicKey
  switchKey: PublicKey
  nextRequiredPing: number
  timestamp: number
}

export interface SwitchDeactivatedEvent {
  switch: PublicKey
  timestamp: number
}

export interface SwitchClosedEvent {
  switch: PublicKey
  owner: PublicKey
  recoveredLamports: number
  timestamp: number
}

// Program errors (matches updated lib.rs ErrorCode enum)
export enum ProgramError {
  InvalidInterval = 6000,
  DataTooLarge = 6001,
  EmptyData = 6002,
  TimeOverflow = 6003,
  InvalidSwitchId = 6004,
  Unauthorized = 6005,
  Expired = 6006,
  NotExpired = 6007,
  InvalidTimestamp = 6008,
}

// Enhanced switch with computed properties for optimized UI rendering
export interface EnrichedSwitch {
  publicKey: PublicKey
  account: DeadManSwitch
  computed?: {
    isExpired: boolean
    expirationTime: number
    timeSinceExpiry: number
    timeUntilExpiry: number
  }
}

/**
 * Safely converts BigInt values to numbers with overflow protection.
 * 
 * This utility handles the conversion of BigInt values returned by Anchor
 * deserialization to regular JavaScript numbers. Provides warnings when
 * precision loss might occur due to values exceeding MAX_SAFE_INTEGER.
 * 
 * @param value - The BigInt or number value to convert
 * @returns Regular JavaScript number (precision loss possible for very large values)
 */
export const safeBigIntToNumber = (value: number | bigint | unknown): number => {
  // Already a plain number → return immediately
  if (typeof value === 'number') return value

  // Handle native BigInt
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      console.warn('⚠️ BigInt value exceeds MAX_SAFE_INTEGER, precision may be lost:', value)
    }
    return Number(value)
  }

  // Handle bn.js instances (detected by presence of toNumber method)
  if (value && typeof value === 'object' && typeof (value as any).toNumber === 'function') {
    try {
      const n = (value as any).toNumber()
      if (n > Number.MAX_SAFE_INTEGER) {
        console.warn('⚠️ BN-like value exceeds MAX_SAFE_INTEGER, precision may be lost:', n)
      }
      return n
    } catch (_) {
      console.warn('⚠️ Failed to convert BN-like object to number, falling back to generic conversion')
    }
  }

  // Generic fallback – risk of precision loss but avoids NaN / string concatenation bugs
  const num = Number(value as any)
  if (Number.isNaN(num)) {
    console.error('❌ Unable to safely convert value to number:', value)
    return 0
  }
  return num
}

/**
 * Safely converts Unix timestamps (possibly BigInt) to JavaScript Date objects.
 * 
 * Handles both number and BigInt timestamp values that come from Solana/Anchor,
 * ensuring proper conversion to Date objects for display purposes.
 * 
 * @param timestamp - Unix timestamp in seconds (number or BigInt)
 * @returns JavaScript Date object
 */
export const safeDateFromTimestamp = (timestamp: number | bigint): Date => {
  const safeTimestamp = safeBigIntToNumber(timestamp)
  return new Date(safeTimestamp * 1000)
}

/**
 * Safely calculates switch expiration timing with overflow protection.
 * 
 * This function performs time calculations for Dead Man's Switch expiration
 * logic while protecting against integer overflow. It handles BigInt values
 * from Anchor deserialization and provides safe fallbacks for edge cases.
 * 
 * @param lastPing - Unix timestamp of the last ping (number or BigInt)
 * @param pingInterval - Required interval between pings in seconds (number or BigInt)
 * @returns Object containing expiration time, time remaining, and expiration status
 */
export const safeTimeCalculation = (lastPing: number | bigint, pingInterval: number | bigint): {
  expirationTime: number
  timeRemaining: number
  isExpired: boolean
} => {
  const lastPingNum = safeBigIntToNumber(lastPing)
  const pingIntervalNum = safeBigIntToNumber(pingInterval)
  const currentTime = Math.floor(Date.now() / 1000)
  
  // Check for overflow before calculation
  if (lastPingNum > Number.MAX_SAFE_INTEGER - pingIntervalNum) {
    console.warn('⚠️ Timestamp overflow risk in time calculation')
    return {
      expirationTime: Number.MAX_SAFE_INTEGER,
      timeRemaining: 0,
      isExpired: true
    }
  }
  
  const expirationTime = lastPingNum + pingIntervalNum
  const timeRemaining = expirationTime - currentTime
  const isExpired = timeRemaining <= 0
  
  return { expirationTime, timeRemaining, isExpired }
}