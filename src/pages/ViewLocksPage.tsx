import { FC, useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PublicKey } from '@solana/web3.js'
import { useProgram } from '../hooks/useProgram'
import { useLitProtocol } from '../hooks/useLitProtocol'
import type { DeadManSwitch } from '../types'
import { safeBigIntToNumber, safeDateFromTimestamp } from '../types'

interface SwitchCardProps {
  switch_: {
    publicKey: PublicKey
    account: DeadManSwitch
    computed: {
      isExpired: boolean
      expirationTime: number
      timeSinceExpiry: number
      timeUntilExpiry: number
    }
  }
  onDecrypt: (switchPDA: string) => Promise<string | null>
  isDecrypting: boolean
}

const SwitchCard: FC<SwitchCardProps> = ({ switch_, onDecrypt, isDecrypting }) => {
  const { account, publicKey, computed } = switch_
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null)
  const [decryptError, setDecryptError] = useState<string | null>(null)

  const handleDecrypt = async () => {
    setDecryptError(null)
    try {
      const message = await onDecrypt(publicKey.toString())
      setDecryptedMessage(message)
    } catch (err) {
      console.error('Decryption failed:', err)
      setDecryptError(err instanceof Error ? err.message : 'Decryption failed')
    }
  }

  // Use safe utility functions
  const lastPing = safeBigIntToNumber(account.lastPing)
  const pingInterval = safeBigIntToNumber(account.pingInterval)

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'EXPIRED'
    
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const formatTimeSince = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    return `${mins} minute${mins === 1 ? '' : 's'} ago`
  }

  // Color coding based on switch status
  const getStatusColor = () => {
    if (computed.isExpired) return 'border-red-500/50 bg-red-500/10'
    if (computed.timeUntilExpiry <= 3600) return 'border-yellow-500/50 bg-yellow-500/10' // Expiring soon
    return 'border-green-500/50 bg-green-500/10'
  }

  const getStatusBadgeColor = () => {
    if (computed.isExpired) return 'text-red-400 bg-red-900/30 border-red-500/50'
    if (computed.timeUntilExpiry <= 3600) return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/50'
    return 'text-green-400 bg-green-900/30 border-green-500/50'
  }

  return (
    <div className={`glassmorphism p-6 border-l-4 ${getStatusColor()}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
                  <Link 
          to={`/lock/${publicKey.toString()}`}
          className="text-lg font-semibold text-white hover:text-purple-300 transition-colors mb-1 block"
        >
          Switch {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-4)}
        </Link>
          <p className="text-sm text-gray-300">
            Owner: {account.owner.toString().slice(0, 8)}...{account.owner.toString().slice(-4)}
          </p>
          <p className="text-xs text-gray-400">
            Created: {safeDateFromTimestamp(account.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm border ${getStatusBadgeColor()}`}>
          {computed.isExpired ? 'EXPIRED' : account.active ? 'ACTIVE' : 'INACTIVE'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Interval:</span>
          <p className="text-white">
            {pingInterval >= 86400 
              ? `${Math.floor(pingInterval / 86400)} days`
              : `${Math.floor(pingInterval / 3600)} hours`
            }
          </p>
        </div>
        <div>
          <span className="text-gray-400">Last Ping:</span>
          <p className="text-white">
            {safeDateFromTimestamp(lastPing).toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-gray-400">
            {computed.isExpired ? 'Expired:' : 'Time Remaining:'}
          </span>
          <p className={`font-medium ${
            computed.isExpired ? 'text-red-400' : 
            computed.timeUntilExpiry <= 3600 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {computed.isExpired 
              ? formatTimeSince(computed.timeSinceExpiry)
              : formatTimeRemaining(computed.timeUntilExpiry)
            }
          </p>
        </div>
        <div>
          <span className="text-gray-400">Data Length:</span>
          <p className="text-white">{account.dataLength} bytes</p>
        </div>
      </div>

      {/* Decryption section for expired switches */}
      {computed.isExpired && account.dataLength > 0 && (
        <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-white font-medium">🔓 Unlock Secret Message</h4>
            <button
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {isDecrypting ? 'Decrypting...' : 'Decrypt Message'}
            </button>
          </div>

          {decryptedMessage && (
            <div className="bg-green-900/20 border border-green-500/30 rounded p-3 mt-3">
              <p className="text-green-300 text-sm font-semibold mb-1">🔓 Decrypted Message:</p>
              <p className="text-white break-words">{decryptedMessage}</p>
            </div>
          )}

          {decryptError && (
            <div className="bg-red-900/20 border border-red-500/30 rounded p-3 mt-3">
              <p className="text-red-300 text-sm">❌ {decryptError}</p>
            </div>
          )}
        </div>
      )}

      {/* Info for active switches */}
      {!computed.isExpired && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
          <p className="text-green-300 text-sm">
            🔒 This switch is still active. The secret message will only be revealed when it expires.
          </p>
        </div>
      )}
    </div>
  )
}

export const ViewLocksPage: FC = () => {
  const { getAllSwitches } = useProgram()
  const { decryptMessage } = useLitProtocol()
  
  const [allSwitches, setAllSwitches] = useState<Array<{
    publicKey: PublicKey
    account: DeadManSwitch
    computed: {
      isExpired: boolean
      expirationTime: number
      timeSinceExpiry: number
      timeUntilExpiry: number
    }
  }>>([])
  const [filteredSwitches, setFilteredSwitches] = useState<typeof allSwitches>([])
  const [showOnlyExpired, setShowOnlyExpired] = useState(false)
  const [isLoading, setIsLoading] = useState(false) // Changed to false - only load when user clicks refresh
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [lastLoadTime, setLastLoadTime] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [decryptingSwitch, setDecryptingSwitch] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  // 30-second cache duration
  const CACHE_DURATION = 30 * 1000 // 30 seconds

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadSwitches = useCallback(async (forceReload = false) => {
    const now = Date.now()
    const timeSinceLastLoad = now - lastLoadTime
    const isCacheValid = timeSinceLastLoad < CACHE_DURATION

    // Check if we can use cached data
    if (!forceReload && hasLoadedOnce && isCacheValid) {
      const remainingCacheTime = Math.ceil((CACHE_DURATION - timeSinceLastLoad) / 1000)
      console.log(`📋 Using cached switches data (${remainingCacheTime}s remaining)`)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔄 Loading latest 16 switches... (optimized for performance)')
      if (isCacheValid && hasLoadedOnce) {
        console.log('⏰ Cache expired, refreshing data...')
      } else {
        console.log('🎯 Fetching most recent switches to reduce rate limiting')
      }
      
      // Limit to 16 most recent switches
      const switches = await getAllSwitches(16)
      console.log('📊 Loaded', switches.length, 'latest switches')
      
      if (isMountedRef.current) {
        setAllSwitches(switches as any)
        setHasLoadedOnce(true)
        setLastLoadTime(now)
        console.log('✅ Data cached for 30 seconds')
      }
    } catch (err) {
      console.error('Failed to load switches:', err)
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load switches')
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [getAllSwitches, hasLoadedOnce, lastLoadTime, CACHE_DURATION])

  // Filter switches based on toggle
  useEffect(() => {
    if (showOnlyExpired) {
      setFilteredSwitches(allSwitches.filter(switch_ => switch_.computed.isExpired))
    } else {
      setFilteredSwitches(allSwitches)
    }
  }, [allSwitches, showOnlyExpired])

  const handleDecrypt = async (switchPDA: string): Promise<string | null> => {
    setDecryptingSwitch(switchPDA)
    try {
      const message = await decryptMessage(switchPDA)
      return message
    } catch (error) {
      console.error('Decryption failed:', error)
      throw error
    } finally {
      setDecryptingSwitch(null)
    }
  }

  // Don't auto-load switches on mount to avoid rate limiting
  // Users need to click "Load Switches" button instead
  useEffect(() => {
    // Only auto-load if we have cached data
    if (hasLoadedOnce && allSwitches.length > 0) {
      console.log('📋 Displaying cached switches data')
    }
  }, [hasLoadedOnce, allSwitches.length])

  // Calculate stats
  const expiredCount = allSwitches.filter(s => s.computed.isExpired).length
  const activeCount = allSwitches.filter(s => !s.computed.isExpired && s.account.active).length
  const inactiveCount = allSwitches.filter(s => !s.computed.isExpired && !s.account.active).length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-white">View Locks</h1>
          <div className="flex items-center space-x-4">
            {/* Filter Toggle */}
            {hasLoadedOnce && (
              <div className="flex items-center space-x-3">
                <span className="text-white text-sm">Viewing:</span>
                <button
                  onClick={() => setShowOnlyExpired(false)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    !showOnlyExpired 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  All Locks ({allSwitches.length})
                </button>
                <button
                  onClick={() => setShowOnlyExpired(true)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    showOnlyExpired 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Expired Only ({expiredCount})
                </button>
              </div>
            )}
            
            <button
              onClick={() => loadSwitches(true)}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              {isLoading ? 'Loading...' : hasLoadedOnce ? 'Refresh' : 'Load Switches'}
            </button>
            
            {/* Cache indicator */}
            {hasLoadedOnce && !isLoading && (
              <div className="text-xs text-gray-400">
                {(() => {
                  const timeSinceLoad = Date.now() - lastLoadTime
                  const cacheRemaining = Math.max(0, Math.ceil((CACHE_DURATION - timeSinceLoad) / 1000))
                  return cacheRemaining > 0 
                    ? `Cached (${cacheRemaining}s)` 
                    : 'Cache expired'
                })()}
              </div>
            )}
          </div>
        </div>
        
        <p className="text-white mb-4">
          View the latest dead man's switches on the network. Expired switches reveal their secret messages.
          {!hasLoadedOnce && (
            <span className="block text-purple-300 text-sm mt-1">
              💡 Click "Load Switches" to fetch the latest 16 switches. Data is cached for 30 seconds.
            </span>
          )}
          {hasLoadedOnce && (
            <span className="block text-gray-400 text-sm mt-1">
              📊 Showing the 16 most recent switches (sorted by creation date)
            </span>
          )}
        </p>

        {/* Stats - only show if data is loaded */}
        {hasLoadedOnce && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="glassmorphism p-4 text-center">
              <p className="text-2xl font-bold text-white">{allSwitches.length}</p>
              <p className="text-sm text-gray-300">Latest Switches</p>
            </div>
            <div className="glassmorphism p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{activeCount}</p>
              <p className="text-sm text-gray-300">Active</p>
            </div>
            <div className="glassmorphism p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{expiredCount}</p>
              <p className="text-sm text-gray-300">Expired</p>
            </div>
            <div className="glassmorphism p-4 text-center">
              <p className="text-2xl font-bold text-gray-400">{inactiveCount}</p>
              <p className="text-sm text-gray-300">Inactive</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="glassmorphism p-4 border-l-4 border-red-500 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glassmorphism p-6 border border-gray-600 loading">
              <div className="h-6 bg-gray-700 rounded mb-4"></div>
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-4 bg-gray-700 rounded mb-4"></div>
              <div className="h-10 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : !hasLoadedOnce ? (
        <div className="text-center py-12">
          <div className="glassmorphism p-8">
            <button
              onClick={() => loadSwitches(true)}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Loading...' : '🔍 Load Switches'}
            </button>
          </div>
        </div>
      ) : filteredSwitches.length === 0 ? (
        <div className="text-center py-12">
          <div className="glassmorphism p-8">
            <h3 className="text-xl font-semibold text-white mb-4">
              {showOnlyExpired ? 'No Expired Switches Found' : 'No Switches Found'}
            </h3>
            <p className="text-white mb-6">
              {showOnlyExpired 
                ? 'There are no expired switches available to decrypt.' 
                : 'No dead man\'s switches have been created yet.'
              }
            </p>
            {showOnlyExpired && allSwitches.length > 0 && (
              <button
                onClick={() => setShowOnlyExpired(false)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                View All Switches
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSwitches.map((switch_) => (
            <SwitchCard
              key={switch_.publicKey.toString()}
              switch_={switch_}
              onDecrypt={handleDecrypt}
              isDecrypting={decryptingSwitch === switch_.publicKey.toString()}
            />
          ))}
        </div>
      )}
    </div>
  )
}