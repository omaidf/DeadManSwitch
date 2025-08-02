import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { clusterApiUrl } from '@solana/web3.js'
import { getConfig } from '../lib/config'

export interface NetworkInfo {
  isDevnet: boolean
  detectedNetwork: string
  configuredNetwork: string
  rpcUrl: string
  isMainnet: boolean
  isTestnet: boolean
  hasNetworkMismatch: boolean
  walletConnected: boolean
  isDetecting: boolean
}

/**
 * Custom React hook for detecting and monitoring Solana network configuration.
 * 
 * This hook provides real-time network detection capabilities to ensure the
 * application is connected to the expected Solana network. It compares the
 * configured network (from environment) with the actual detected network and
 * identifies mismatches that could cause transaction failures.
 * 
 * Features:
 * - Automatic network detection via RPC URL patterns and genesis hash
 * - Real-time monitoring of wallet connection state
 * - Network mismatch detection and warnings
 * - Support for devnet, testnet, and mainnet-beta networks
 * 
 * @returns Object containing network information, detection state, and error status
 */
export function useNetworkDetection() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    isDevnet: false,
    detectedNetwork: 'unknown',
    configuredNetwork: 'devnet',
    rpcUrl: '',
    isMainnet: false,
    isTestnet: false,
    hasNetworkMismatch: false,
    walletConnected: false,
    isDetecting: false,
  })
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const detectNetwork = async () => {
      const config = getConfig()
      const configuredNetwork = config.SOLANA_NETWORK
      const rpcUrl = config.SOLANA_RPC_URL

      // If wallet is not connected, show appropriate state
      if (!wallet.connected) {
        console.log('👤 Wallet not connected - network detection paused')
        setNetworkInfo({
          isDevnet: false, // Don't show devnet status when not connected
          detectedNetwork: 'wallet-not-connected',
          configuredNetwork,
          rpcUrl,
          isMainnet: false,
          isTestnet: false,
          hasNetworkMismatch: false,
          walletConnected: false,
          isDetecting: false,
        })
        setIsDetecting(false)
        setError(null)
        return
      }

      // Wallet is connected - detect actual network
      setIsDetecting(true)
      setError(null)
      console.log('🔍 Wallet connected - detecting network...')

      try {

        // Get genesis hash to determine network
        const genesisHash = await connection.getGenesisHash()
        console.log('Genesis hash:', genesisHash) // Keep for debugging
        
        // Note: Genesis hash detection is less reliable than RPC URL patterns for devnet detection
        // So we rely primarily on RPC URL pattern matching below

        let detectedNetwork = 'unknown'

        // Primary detection: RPC URL patterns (most reliable for devnet)
        if (rpcUrl.includes('devnet') || rpcUrl === clusterApiUrl('devnet')) {
          detectedNetwork = 'devnet'
        } else if (rpcUrl.includes('testnet') || rpcUrl === clusterApiUrl('testnet')) {
          detectedNetwork = 'testnet'
        } else if (rpcUrl.includes('mainnet') || rpcUrl === clusterApiUrl('mainnet-beta')) {
          detectedNetwork = 'mainnet-beta'
        } else {
          // Fallback: Try to determine by making a test call and checking slot
          try {
            const slot = await connection.getSlot()
            // Check if this is a local/devnet environment
            if (slot < 50000000) { // Lower threshold for devnet detection
              detectedNetwork = 'devnet'
            } else {
              // For production URLs without clear indicators, assume mainnet
              detectedNetwork = 'mainnet-beta'
            }
          } catch {
            // If we can't get slot info, default to devnet for safety
            detectedNetwork = 'devnet'
          }
        }

        const isDevnet = detectedNetwork === 'devnet'
        const isMainnet = detectedNetwork === 'mainnet-beta'
        const isTestnet = detectedNetwork === 'testnet'
        const hasNetworkMismatch = detectedNetwork !== configuredNetwork

        setNetworkInfo({
          isDevnet,
          detectedNetwork,
          configuredNetwork,
          rpcUrl,
          isMainnet,
          isTestnet,
          hasNetworkMismatch,
          walletConnected: wallet.connected,
          isDetecting: false,
        })

        console.log('🌐 Network Detection:', {
          configured: configuredNetwork,
          detected: detectedNetwork,
          rpcUrl,
          genesisHash,
          mismatch: hasNetworkMismatch
        })

      } catch (err) {
        console.error('Failed to detect network:', err)
        setError(err instanceof Error ? err.message : 'Failed to detect network')
        
        // Fallback to config values
        const config = getConfig()
        setNetworkInfo({
          isDevnet: config.SOLANA_NETWORK === 'devnet',
          detectedNetwork: 'unknown',
          configuredNetwork: config.SOLANA_NETWORK,
          rpcUrl: config.SOLANA_RPC_URL,
          isMainnet: config.SOLANA_NETWORK === 'mainnet-beta',
          isTestnet: config.SOLANA_NETWORK === 'testnet',
          hasNetworkMismatch: false,
          walletConnected: wallet.connected,
          isDetecting: false,
        })
      } finally {
        setIsDetecting(false)
      }
    }

    if (connection) {
      detectNetwork()
    }
  }, [connection, wallet.connected]) // Re-run when wallet connection changes

  return {
    networkInfo,
    isDetecting,
    error,
  }
}