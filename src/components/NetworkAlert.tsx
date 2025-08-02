import { FC } from 'react'
import { useNetworkDetection } from '../hooks/useNetworkDetection'

/**
 * Network alert component that displays important network status warnings.
 * 
 * This component provides contextual alerts based on network detection:
 * - Wallet connection prompts for disconnected users
 * - Network detection loading states
 * - Critical warnings for non-devnet usage (mainnet/testnet)
 * - Network mismatch alerts between config and detected network
 * - Success confirmations for proper devnet connections
 * 
 * The component automatically chooses the most important alert to display
 * based on current network state and connection status. Alerts are styled
 * with appropriate colors and icons to indicate severity.
 * 
 * @returns JSX element with contextual network alert or null if no alert needed
 */
export const NetworkAlert: FC = () => {
  const { networkInfo, isDetecting } = useNetworkDetection()

  // Don't show anything if wallet is not connected
  if (!networkInfo.walletConnected) {
    return (
      <div className="glassmorphism p-3 border-l-4 border-gray-500">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-gray-300 font-semibold text-sm">👤 Connect Wallet</h4>
            <p className="text-gray-400 text-sm mt-1">
              Connect your wallet to verify network
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isDetecting) {
    return (
      <div className="glassmorphism p-3 border-l-4 border-blue-500">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
          <span className="text-blue-300 text-sm">Detecting network...</span>
        </div>
      </div>
    )
  }

  // Show alert if not on devnet (and wallet is connected)
  if (!networkInfo.isDevnet) {
    return (
      <div className="glassmorphism p-3 border-l-4 border-red-500">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-red-300 font-semibold text-sm">⚠️ WRONG NETWORK</h4>
            <p className="text-red-200 text-sm mt-1">
              You're on <strong>{networkInfo.detectedNetwork.toUpperCase()}</strong>
            </p>
            <p className="text-red-200 text-xs mt-1 font-medium">
              ⚠️ DEVNET REQUIRED FOR SAFE TESTING
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show network mismatch warning
  if (networkInfo.hasNetworkMismatch) {
    return (
      <div className="glassmorphism p-3 border-l-4 border-yellow-500">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-yellow-300 font-semibold text-sm">⚠️ Network Mismatch</h4>
            <p className="text-yellow-200 text-sm mt-1">
              Config: <strong>{networkInfo.configuredNetwork.toUpperCase()}</strong> | 
              Detected: <strong>{networkInfo.detectedNetwork.toUpperCase()}</strong>
            </p>
            <p className="text-yellow-200 text-xs mt-1 font-medium">
              Check your RPC configuration
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show success for devnet
  return (
    <div className="glassmorphism p-3 border-l-4 border-green-500">
      <div className="flex items-center">
        <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <div>
          <span className="text-green-300 text-sm font-medium">✅ Connected to Devnet</span>
          <p className="text-green-200 text-xs opacity-80">Safe for testing</p>
        </div>
      </div>
    </div>
  )
}