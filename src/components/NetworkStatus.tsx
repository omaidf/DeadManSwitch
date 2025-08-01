import { FC } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useNetworkDetection } from '../hooks/useNetworkDetection'

export const NetworkStatus: FC = () => {
  const { connection } = useConnection()
  const { networkInfo, isDetecting } = useNetworkDetection()

  return (
    <div className="glassmorphism p-4">
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
        <span className="text-xl mr-2">🌐</span>
        Network Status
      </h3>
      
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Connection:</span>
          <span className={`font-medium flex items-center ${connection ? 'text-green-400' : 'text-red-400'}`}>
            {isDetecting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-400 mr-1"></div>
                Detecting...
              </span>
            ) : (
              <>
                <div className={`w-2 h-2 rounded-full mr-2 ${connection ? 'bg-green-400' : 'bg-red-400'}`}></div>
                {connection ? 'Connected' : 'Disconnected'}
              </>
            )}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Network:</span>
          <span className={`font-medium px-2 py-1 rounded text-xs ${
            networkInfo.isDevnet ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
            networkInfo.isMainnet ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
            'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
          }`}>
            {networkInfo.detectedNetwork.toUpperCase()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Expected:</span>
          <span className="text-white text-xs font-mono">
            {networkInfo.configuredNetwork.toUpperCase()}
          </span>
        </div>

        {networkInfo.hasNetworkMismatch && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded p-2">
            <span className="text-yellow-300 text-xs">
              ⚠️ Network mismatch detected
            </span>
          </div>
        )}

        <div className="border-t border-gray-700/50 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">RPC Endpoint:</span>
          </div>
          <div className="text-white text-xs font-mono mt-1 p-2 bg-gray-800/50 rounded truncate" title={networkInfo.rpcUrl}>
            {networkInfo.rpcUrl || 'Not configured'}
          </div>
        </div>

        {networkInfo.isMainnet && (
          <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 rounded p-2">
            <span className="text-red-300 text-xs font-semibold">
              ⚠️ MAINNET - Real SOL required
            </span>
          </div>
        )}

        {networkInfo.isDevnet && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded p-2">
            <span className="text-green-300 text-xs font-semibold">
              ✅ DEVNET - Safe for testing
            </span>
          </div>
        )}
      </div>
    </div>
  )
}