import { PublicKey } from '@solana/web3.js'

// Environment configuration
export interface EnvConfig {
  SOLANA_NETWORK: 'devnet' | 'testnet' | 'mainnet-beta'
  SOLANA_RPC_URL: string
  PROGRAM_ID: string
  LIT_NETWORK: 'datil-dev' | 'datil-test' | 'mainnet'
}

// Dead Man's Switch account structure (matches IDL)
export interface DeadManSwitch {
  owner: PublicKey
  lastPing: number | bigint  // Can be bigint from Anchor deserialization
  pingInterval: number | bigint  // Can be bigint from Anchor deserialization  
  encryptedData: number[]  // Fixed array [u8; 512] comes as number array from Anchor
  dataLength: number      // u16 field tracking actual data size
  createdAt: number | bigint  // Can be bigint from Anchor deserialization
  active: boolean
  bump: number
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

// Program errors (matches IDL)
export enum ProgramError {
  InvalidInterval = 6000,
  DataTooLarge = 6001,
  EmptyData = 6002,
  TimeOverflow = 6003,
  InvalidSwitchId = 6004,
  Unauthorized = 6005,
  InactiveSwitch = 6006,
  ActiveSwitch = 6007,
  NotExpired = 6008,
  InvalidTimestamp = 6009,
  ArithmeticOverflow = 6010,
  AlreadyInactive = 6011,
}

// Utility functions for safe BigInt handling
export const safeBigIntToNumber = (value: number | bigint): number => {
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      console.warn('⚠️ BigInt value exceeds MAX_SAFE_INTEGER, precision may be lost:', value)
      return Number(value)
    }
    return Number(value)
  }
  return value
}

export const safeDateFromTimestamp = (timestamp: number | bigint): Date => {
  const safeTimestamp = safeBigIntToNumber(timestamp)
  return new Date(safeTimestamp * 1000)
}

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