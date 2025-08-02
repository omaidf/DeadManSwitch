import { FC, useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useProgram } from '../hooks/useProgram'
import type { DeadManSwitch } from '../types'
import { safeBigIntToNumber, safeDateFromTimestamp, safeTimeCalculation } from '../types'

interface SwitchCardProps {
  switch_: {
    publicKey: PublicKey
    account: DeadManSwitch
  }
  onPing: (switchPDA: PublicKey) => Promise<void>
  isPinging: boolean
}

/**
 * Individual switch card component for displaying switch information and controls.
 * 
 * Renders a comprehensive card showing:
 * - Switch identification and creation details
 * - Current status (active/expired) with color-coded indicators
 * - Timing information (interval, last ping, time remaining)
 * - Ping button for active switches
 * - Expiration warnings and notifications
 * 
 * @param props - Component props
 * @param props.switch_ - Switch data object with account info and public key
 * @param props.onPing - Callback function to ping the switch
 * @param props.isPinging - Boolean indicating if ping operation is in progress
 * @returns JSX element with switch card UI
 */
const SwitchCard: FC<SwitchCardProps> = ({ switch_, onPing, isPinging }) => {
  const { account, publicKey } = switch_
  
  // Use safe time calculation utility
  const { timeRemaining, isExpired } = safeTimeCalculation(account.lastPing, account.pingInterval)
  const isExpiringSoon = timeRemaining <= 3600 && timeRemaining > 0 // Less than 1 hour
  const lastPing = safeBigIntToNumber(account.lastPing)

  /**
   * Formats time remaining in a human-readable format.
   * 
   * Converts seconds to a compact string representation showing
   * the most relevant time units (days, hours, minutes).
   * 
   * @param seconds - Time remaining in seconds
   * @returns Formatted string like "2d 5h", "3h 45m", or "EXPIRED"
   */
  /**
   * Formats remaining seconds into a concise, human-friendly string.
   *  • < 1 min   → “< 1m”
   *  • < 1 hour → “Xm Ys”
   *  • < 1 day  → “Xh Ym”
   *  • < 1 year → “Xd Yh”
   *  • ≥ 1 year → “Xy Zd” (years rounded down)
   */
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'EXPIRED'

    const years = Math.floor(seconds / 31_536_000) // 365 d
    const days  = Math.floor((seconds % 31_536_000) / 86_400)
    const hours = Math.floor((seconds % 86_400) / 3_600)
    const mins  = Math.floor((seconds % 3_600) / 60)

    if (years > 0)           return `${years}y ${days}d`
    if (days > 0)            return `${days}d ${hours}h`
    if (hours > 0)           return `${hours}h ${mins}m`
    if (mins > 0)            return `${mins}m`
    return '< 1m'
  }

  /**
   * Determines the appropriate color classes for switch status indicator.
   * 
   * Returns Tailwind CSS classes for styling the status badge based on
   * switch expiration state and time remaining.
   * 
   * @returns String containing Tailwind CSS classes for status styling
   */
  const getStatusColor = () => {
    if (isExpired) return 'text-red-400 bg-red-900/20 border-red-500/30'
    if (isExpiringSoon) return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30'
    return 'text-green-400 bg-green-900/20 border-green-500/30'
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-600">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Link 
          to={`/lock/${publicKey.toString()}`}
          className="text-lg font-semibold text-white hover:text-purple-300 transition-colors mb-1 block"
        >
          Switch {publicKey.toString().slice(0, 8)}
        </Link>
          <p className="text-sm text-gray-400">
            Created: {safeDateFromTimestamp(account.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm border ${getStatusColor()}`}>
          {isExpired ? 'EXPIRED' : 'ACTIVE'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Interval:</span>
          <p className="text-white">
            {safeBigIntToNumber(account.pingInterval) >= 86400 
              ? `${Math.floor(safeBigIntToNumber(account.pingInterval) / 86400)} days`
              : `${Math.floor(safeBigIntToNumber(account.pingInterval) / 3600)} hours`
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
          <span className="text-gray-400">Time Remaining:</span>
          <p className={`font-medium ${isExpired ? 'text-red-400' : isExpiringSoon ? 'text-yellow-400' : 'text-green-400'}`}>
            {formatTimeRemaining(timeRemaining)}
          </p>
        </div>
        <div>
          <span className="text-gray-400">Switch Address:</span>
          <p className="text-white text-xs font-mono">
            {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
          </p>
        </div>
      </div>

      {account.active && !isExpired && (
        <button
          onClick={() => onPing(publicKey)}
          disabled={isPinging}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {isPinging ? 'Pinging...' : 'Ping Switch'}
        </button>
      )}

      {isExpired && (
        <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
          <p className="text-red-300 text-sm">
            This switch has expired. Your message may now be visible to the public.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * My Switches page component for managing user's Dead Man's Switch instances.
 * 
 * This page provides a comprehensive dashboard for switch management:
 * - Displays all switches owned by the connected wallet
 * - Shows real-time status, timing, and expiration information
 * - Provides ping functionality to reset switch timers
 * - Includes statistics and overview of switch portfolio
 * - Handles loading states and error conditions gracefully
 * 
 * Features:
 * - Optimized queries with caching to avoid rate limiting
 * - Manual refresh capability for real-time updates
 * - First-time user detection and onboarding
 * - Responsive grid layout for switch cards
 * - Quick statistics dashboard
 * 
 * @returns JSX element containing the complete switches management interface
 */
export const MySwitchesPage: FC = () => {
  const { connected } = useWallet()
  const { getUserSwitches, pingSwitch } = useProgram()
  const [switches, setSwitches] = useState<Array<{ publicKey: PublicKey, account: DeadManSwitch }>>([])
  const [isLoading, setIsLoading] = useState(false) // Will be set to true when auto-loading starts
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pingingSwitch, setPingingSwitch] = useState<string | null>(null)
    // Track component mount status to avoid updating state after unmount
  const isMountedRef = useRef(false)

  useEffect(() => {
    // Mark as mounted when effect runs (handles React Strict Mode double render)
    isMountedRef.current = true
    return () => {
      // Cleanup toggles the flag so async callbacks can check before updating state
      isMountedRef.current = false
    }
  }, [])

  // Debug: Track switches state changes
  useEffect(() => {
    console.log('🔍 Debug - switches state changed:', { length: switches.length, hasLoadedOnce, isLoading })
  }, [switches, hasLoadedOnce, isLoading])

  /**
   * Loads user switches from the blockchain with caching and optimization.
   * 
   * This function implements an optimized loading strategy to minimize RPC calls:
   * - Uses cached data when available to avoid rate limiting
   * - Only reloads when forced or when switching users
   * - Provides comprehensive error handling and loading states
   * 
   * @param forceReload - Whether to bypass cache and reload from blockchain
   */
  const loadSwitches = useCallback(async (forceReload = false) => {
    if (!connected) {
      console.log('❌ Not connected, skipping switch load')
      return
    }

    // Prevent concurrent calls
    if (isLoading && !forceReload) {
      console.log('⏳ Already loading, skipping duplicate call')
      return
    }

    // Only load if forced, never loaded before, or switching users
    if (!forceReload && hasLoadedOnce) {
      console.log('📋 Using cached user switches to avoid rate limiting')
      return
    }

          console.log('🚀 Starting switch load, forceReload:', forceReload, 'hasLoadedOnce:', hasLoadedOnce, 'isLoading:', isLoading)
      setIsLoading(true)
      setError(null)

      try {
        console.log('🔄 Loading user switches with optimized query...')
        const userSwitches = await getUserSwitches()
        console.log('📊 Loaded', userSwitches.length, 'switches')
        
        if (isMountedRef.current) {
          console.log('✅ Setting switches data and hasLoadedOnce=true')
          console.log('🔍 Debug - switches data:', userSwitches)
          console.log('🔍 Debug - current state before update:', { switchesLength: switches.length, hasLoadedOnce, isLoading })
          
          // CRITICAL FIX: Use functional updates to ensure proper state sequencing
          setSwitches(prevSwitches => {
            console.log('🔍 Setting switches from', prevSwitches.length, 'to', userSwitches.length)
            return userSwitches as any
          })
          setHasLoadedOnce(true)
          setIsLoading(false)
          console.log('✅ All states updated successfully')
        }
      } catch (err) {
        console.error('❌ Failed to load switches:', err)
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load switches')
          setIsLoading(false)
        }
      }
  }, [connected]) // Program functions are used directly, no need in deps

  /**
   * Handles pinging a specific switch to reset its expiration timer.
   * 
   * Executes the ping transaction and updates the local switch data
   * to reflect the new timing information. Provides user feedback
   * during the process and handles errors gracefully.
   * 
   * @param switchPDA - The Program Derived Address of the switch to ping
   */
  const handlePing = async (switchPDA: PublicKey) => {
    setPingingSwitch(switchPDA.toString())
    setError(null) // Clear any previous errors
    
    try {
      await pingSwitch(switchPDA)
      // Reload switches to get updated data
      await loadSwitches()
      console.log('✅ Switch pinged successfully')
    } catch (err) {
      console.error('Failed to ping switch:', err)
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to ping switch')
      }
      // Don't reload switches on error to avoid clearing error state
    } finally {
      if (isMountedRef.current) {
        setPingingSwitch(null)
      }
    }
  }

  // Separate effect for connection state changes
  useEffect(() => {
    console.log('🔍 Debug - connection useEffect triggered:', { connected })
    if (!connected) {
      // Wallet disconnected - clear everything
      if (isMountedRef.current) {
        console.log('🔌 Wallet disconnected, clearing all data...')
        setSwitches([])
        setIsLoading(false)
        setHasLoadedOnce(false)
        console.log('🔌 Wallet disconnected, cleared all data')
      }
    }
  }, [connected])

  // Single effect for initial load - smart auto-loading with cache respect
  useEffect(() => {
    console.log('🔍 Debug - useEffect triggered:', { connected, hasLoadedOnce, isLoading })
    if (connected && !hasLoadedOnce && !isLoading) {
      console.log('🎯 Wallet connected, auto-loading user switches...')
      loadSwitches(false) // Don't force reload, respect cache
    }
  }, [connected, hasLoadedOnce, isLoading]) // Added isLoading to prevent calls while loading

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-300 mb-2">Wallet Required</h2>
          <p className="text-yellow-200">
            Please connect your Solana wallet to view your dead man's switches.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-white">My Switches</h1>
          <button
            onClick={() => loadSwitches(true)}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <p className="text-gray-300">
          Manage your active dead man's switches. Remember to ping regularly to keep your messages secret.
        </p>
      </div>

      {error && (
        <div className="error mb-6">
          {error}
        </div>
      )}



      {/* SIMPLIFIED LOGIC: Show switches if we have them, regardless of loading state */}
      {switches.length > 0 ? (
        <>
          {/* Debug info */}
          
          
          <div>
            {/* Stats */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Quick Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-purple-400">{switches.length}</p>
                  <p className="text-sm text-gray-400">Total Switches</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">
                    {switches.filter(s => s.account.active).length}
                  </p>
                  <p className="text-sm text-gray-400">Active</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {switches.filter(s => {
                      const now = Math.floor(Date.now() / 1000)
                      const lastPing = typeof s.account.lastPing === 'bigint' ? Number(s.account.lastPing) : s.account.lastPing
                      const pingInterval = typeof s.account.pingInterval === 'bigint' ? Number(s.account.pingInterval) : s.account.pingInterval
                      if (lastPing <= Number.MAX_SAFE_INTEGER - pingInterval) {
                        const timeRemaining = (lastPing + pingInterval) - now
                        return s.account.active && timeRemaining <= 3600 && timeRemaining > 0
                      }
                      return false
                    }).length}
                  </p>
                  <p className="text-sm text-gray-400">Expiring Soon</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">
                    {switches.filter(s => {
                      const now = Math.floor(Date.now() / 1000)
                      const lastPing = typeof s.account.lastPing === 'bigint' ? Number(s.account.lastPing) : s.account.lastPing
                      const pingInterval = typeof s.account.pingInterval === 'bigint' ? Number(s.account.pingInterval) : s.account.pingInterval
                      if (lastPing <= Number.MAX_SAFE_INTEGER - pingInterval) {
                        return (lastPing + pingInterval) < now
                      }
                      return true
                    }).length}
                  </p>
                  <p className="text-sm text-gray-400">Expired</p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white mb-3">Your Switches ({switches.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {switches.map((switch_) => (
                <SwitchCard
                  key={switch_.publicKey.toString()}
                  switch_={switch_}
                  onPing={handlePing}
                  isPinging={pingingSwitch === switch_.publicKey.toString()}
                />
              ))}
            </div>

            {/* Duplicate Stats removed */}
          </div>
        </>
      ) : isLoading ? (
        <div className="text-center py-12">
          <div className="glassmorphism p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-white">Loading your switches...</p>
            <p className="text-sm text-gray-400 mt-2">This may take a moment...</p>
          </div>
        </div>
      ) : hasLoadedOnce ? (
        <div className="text-center py-12">
          <div className="bg-gray-800 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-white mb-4">No Switches Found</h3>
            <p className="text-gray-300 mb-6">
              You haven't created any dead man's switches yet.
            </p>
            <a
              href="/create"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Create Your First Switch
            </a>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="glassmorphism p-8">
            <button
              onClick={() => loadSwitches(true)}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Loading...' : '🔍 Load My Switches'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
