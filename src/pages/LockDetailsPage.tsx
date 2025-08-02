import { FC, useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useProgram } from '../hooks/useProgram'
import { useLitProtocol } from '../hooks/useLitProtocol'
import type { DeadManSwitch } from '../types'
import { safeBigIntToNumber, safeDateFromTimestamp, safeTimeCalculation } from '../types'

/**
 * Lock details page component for viewing individual switch information.
 * 
 * This page provides comprehensive details about a specific switch:
 * - Real-time countdown timer with live updates
 * - Complete switch metadata and configuration
 * - Owner-specific actions (ping for active switches)
 * - Public decryption for expired switches
 * - Navigation and error handling
 * 
 * Features:
 * - Live countdown timer updating every second
 * - Owner detection and permission-based UI
 * - Solscan integration for blockchain exploration
 * - Real-time status updates after actions
 * - Comprehensive error handling and recovery
 * 
 * @returns JSX element containing the complete lock details interface
 */
export const LockDetailsPage: FC = () => {
  const { lockId } = useParams<{ lockId: string }>()
  const { connected, publicKey } = useWallet()
  const navigate = useNavigate()
  const { getSwitchInfo, pingSwitch, getActualEncryptedData } = useProgram()
  const { decryptMessage } = useLitProtocol()
  
  const [switchData, setSwitchData] = useState<{
    publicKey: PublicKey
    account: DeadManSwitch
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPinging, setIsPinging] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // Update current time every second for live countdown
  useEffect(() => {
    isMountedRef.current = true
    
    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        setCurrentTime(Math.floor(Date.now() / 1000))
      }
    }, 1000)

    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Load switch data
  useEffect(() => {
    const loadSwitchData = async () => {
      if (!lockId) {
        setError('Invalid lock ID')
        setIsLoading(false)
        return
      }

      try {
        const publicKey = new PublicKey(lockId)
        const switchInfo = await getSwitchInfo(publicKey)
        
        if (isMountedRef.current) {
          setSwitchData({
            publicKey,
            account: switchInfo
          })
        }
      } catch (err) {
        console.error('Failed to load switch data:', err)
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load switch data')
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    loadSwitchData()
  }, [lockId]) // Removed getSwitchInfo to prevent infinite loop

  /**
   * Handles pinging the switch to reset its expiration timer.
   * 
   * Only available to the switch owner for active switches.
   * Updates the local state with fresh data after successful ping.
   */
  const handlePing = async () => {
    if (!switchData || !connected) return

    setIsPinging(true)
    setError(null)

    try {
      await pingSwitch(switchData.publicKey)
      
      // Reload switch data to get updated lastPing
      const updatedInfo = await getSwitchInfo(switchData.publicKey)
      
      if (isMountedRef.current) {
        setSwitchData({
          publicKey: switchData.publicKey,
          account: updatedInfo
        })
        console.log('✅ Switch pinged successfully')
      }
    } catch (err) {
      console.error('Failed to ping switch:', err)
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to ping switch')
      }
    } finally {
      if (isMountedRef.current) {
        setIsPinging(false)
      }
    }
  }

  /**
   * Handles decryption of expired switch messages using Lit Protocol.
   * 
   * Extracts encrypted data from the switch account and attempts
   * decryption through Lit Protocol's access control system.
   */
  const handleDecrypt = async () => {
    if (!switchData) return

    setIsDecrypting(true)
    setError(null)

    try {
      const encryptedData = getActualEncryptedData(switchData.account)
      const encryptedString = new TextDecoder().decode(encryptedData)
      
      console.log('🔍 Attempting to decrypt message for expired switch...')
      const decrypted = await decryptMessage(encryptedString, switchData.publicKey.toString())
      
      if (isMountedRef.current) {
        setDecryptedMessage(decrypted)
      }
    } catch (err) {
      console.error('Failed to decrypt message:', err)
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to decrypt message')
      }
    } finally {
      if (isMountedRef.current) {
        setIsDecrypting(false)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="glassmorphism p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">Loading lock details...</p>
        </div>
      </div>
    )
  }

  if (error && !switchData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="glassmorphism p-8 border-l-4 border-red-500">
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Lock</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <Link
            to="/my-switches"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            ← Back to My Switches
          </Link>
        </div>
      </div>
    )
  }

  if (!switchData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="glassmorphism p-8 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Lock Not Found</h2>
          <p className="text-gray-300 mb-4">The requested lock could not be found.</p>
          <Link
            to="/view-locks"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            ← Browse All Locks
          </Link>
        </div>
      </div>
    )
  }

  const { account } = switchData
  
  // Use safe utility functions for time calculations
  const { timeRemaining, isExpired, expirationTime } = safeTimeCalculation(account.lastPing, account.pingInterval)
  const lastPing = safeBigIntToNumber(account.lastPing)
  const pingInterval = safeBigIntToNumber(account.pingInterval)
  const timeSinceExpiry = Math.max(0, currentTime - expirationTime)
  
  // Calculate expiring soon (within 1 hour)
  const isExpiringSoon = !isExpired && timeRemaining <= 3600

  const isOwner = connected && publicKey && account.owner.equals(publicKey)

  /**
   * Formats time duration with full precision (days, hours, minutes, seconds).
   * 
   * @param seconds - Time duration in seconds
   * @returns Formatted string with appropriate time units
   */
  const formatTime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  /**
   * Determines text color based on switch expiration status.
   * 
   * @returns Tailwind CSS color class for status display
   */
  const getStatusColor = () => {
    if (isExpired) return 'text-red-400'
    if (isExpiringSoon) return 'text-yellow-400'
    return 'text-green-400'
  }

  /**
   * Determines status text based on switch expiration state.
   * 
   * @returns Human-readable status string
   */
  const getStatusText = () => {
    if (isExpired) return 'EXPIRED'
    if (isExpiringSoon) return 'EXPIRING SOON'
    return 'ACTIVE'
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="text-purple-400 hover:text-purple-300 flex items-center space-x-2"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold text-white">Lock Details</h1>
        </div>
        
        <div className="flex items-center space-x-3">
          <span className={`text-lg font-semibold ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          {isOwner && (
            <span className="bg-purple-600 text-white px-2 py-1 rounded text-sm">
              OWNED
            </span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="glassmorphism p-4 border-l-4 border-red-500 mb-6">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lock Information */}
        <div className="glassmorphism p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Lock Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Lock Address</label>
              <div className="font-mono text-white break-all bg-gray-800 p-2 rounded text-sm">
                {switchData.publicKey.toString()}
              </div>
            </div>
            
            <div>
              <label className="text-sm text-gray-400">Owner</label>
              <a href={`https://solscan.io/account/${account.owner.toString()}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="font-mono text-white break-all bg-gray-800 p-2 rounded text-sm underline hover:text-purple-300">
                {account.owner.toString()}
              </a>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400">Status</label>
                <div className={`font-medium ${getStatusColor()}`}>
                  {getStatusText()}
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">Ping Interval</label>
                <div className="text-white">
                  {formatTime(pingInterval)}
                </div>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-gray-400">Last Ping</label>
              <div className="text-white">
                {safeDateFromTimestamp(lastPing).toLocaleString()}
              </div>
            </div>
            
            <div>
              <label className="text-sm text-gray-400">Created</label>
              <div className="text-white">
                {new Date((typeof account.createdAt === 'bigint' ? Number(account.createdAt) : account.createdAt) * 1000).toLocaleString()}
              </div>
            </div>
            
            <div>
              <label className="text-sm text-gray-400">Encrypted Data Size</label>
              <div className="text-white">
                {account.dataLength} bytes
              </div>
            </div>
          </div>
        </div>

        {/* Timer & Actions */}
        <div className="glassmorphism p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Timer & Actions</h2>
          
          {/* Countdown Timer */}
          <div className="text-center mb-6">
            {isExpired ? (
              <div>
                <p className="text-sm text-gray-400 mb-2">Expired</p>
                <div className="text-3xl font-bold text-red-400 font-mono">
                  +{formatTime(timeSinceExpiry)}
                </div>
                <p className="text-sm text-red-300 mt-2">
                  This lock expired {formatTime(timeSinceExpiry)} ago
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-2">Time Until Expiration</p>
                <div className={`text-3xl font-bold font-mono ${getStatusColor()}`}>
                  {formatTime(timeRemaining)}
                </div>
                <p className="text-sm text-gray-300 mt-2">
                  Expires at {new Date(expirationTime * 1000).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
                    {/* Ping Button - only for owner on non-expired switches */}
        {isOwner && !isExpired && (
              <button
                onClick={handlePing}
                disabled={isPinging}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
              >
                {isPinging ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Pinging...</span>
                  </>
                ) : (
                  <>
                    <span>📡</span>
                    <span>Ping Switch</span>
                  </>
                )}
              </button>
            )}

            {/* Decrypt Button - only for expired switches with data */}
            {isExpired && account.dataLength > 0 && (
              <button
                onClick={handleDecrypt}
                disabled={isDecrypting}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
              >
                {isDecrypting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Decrypting...</span>
                  </>
                ) : (
                  <>
                    <span>🔓</span>
                    <span>Decrypt Message</span>
                  </>
                )}
              </button>
            )}

            {/* View in Explorer */}
            <a
              href={`https://solscan.io/account/${switchData.publicKey.toString()}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <span>🔍</span>
              <span>View on Solscan</span>
            </a>
          </div>
        </div>
      </div>

      {/* Decrypted Message */}
      {decryptedMessage && (
        <div className="glassmorphism p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4">🔓 Decrypted Message</h2>
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-white whitespace-pre-wrap">{decryptedMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}