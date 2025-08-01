import React, { useState, useRef, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useProgram } from '../hooks/useProgram'
import { useLitProtocol } from '../hooks/useLitProtocol'

// Constants for message validation
const MIN_PING_INTERVAL = 60 // 1 minute (from lib.rs)
const MAX_PING_INTERVAL = 365 * 24 * 60 * 60 // 1 year (from lib.rs)
const MAX_DATA_SIZE = 512 // bytes (from lib.rs)
const MAX_MESSAGE_SIZE = 200 // Reduced to ensure encrypted data fits within 512 bytes

// Utility function to calculate byte length consistently
const getMessageByteLength = (text: string): number => {
  return new TextEncoder().encode(text).length
}

export const CreatePage = () => {
  const wallet = useWallet()
  const { connected } = wallet
  const programHook = useProgram()
  const { createSwitch, checkUserHasSwitches } = programHook
  const { encryptMessage, connectionStatus } = useLitProtocol()
  
  const [message, setMessage] = useState('')
  const [interval, setInterval] = useState(24) // hours
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Check if user is a first-time user
  useEffect(() => {
    const checkFirstTimeUser = async () => {
      if (!connected) {
        setIsFirstTimeUser(null)
        return
      }

      try {
        const hasSwitches = await checkUserHasSwitches()
        setIsFirstTimeUser(!hasSwitches)
      } catch (error) {
        console.error('Failed to check user switches:', error)
        setIsFirstTimeUser(false) // Default to not first-time on error
      }
    }

    checkFirstTimeUser()
  }, [connected]) // Only depend on connected to prevent loops

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!connected || !message.trim()) return

    setIsCreating(true)
    setError(null)

    // Input validation based on contract constraints
    let intervalSeconds = interval * 3600
    const messageBytes = getMessageByteLength(message)
    
    // Special handling for 1-minute interval (only for first-time users)
    if (Math.abs(interval - 1/60) < 0.0001) {
      if (!isFirstTimeUser) {
        setError('1-minute interval is only available for first-time users')
        setIsCreating(false)
        return
      }
      intervalSeconds = 60 // Override to 60 seconds for 1-minute option
    }
    
    if (intervalSeconds < MIN_PING_INTERVAL) {
      setError(`Ping interval must be at least ${MIN_PING_INTERVAL} seconds (1 minute)`)
      setIsCreating(false)
      return
    }
    
    if (intervalSeconds > MAX_PING_INTERVAL) {
      setError(`Ping interval must be less than ${MAX_PING_INTERVAL} seconds (1 year)`)
      setIsCreating(false)
      return
    }
    
    if (messageBytes > MAX_MESSAGE_SIZE) {
      setError(`Message too large. After encryption, must fit within ${MAX_DATA_SIZE} bytes. Maximum input: ${MAX_MESSAGE_SIZE} bytes, current: ${messageBytes} bytes`)
      setIsCreating(false)
      return
    }
    
    if (messageBytes === 0) {
      setError('Message cannot be empty')
      setIsCreating(false)
      return
    }

    try {
      console.log('🚀 Starting switch creation process...')
      console.log('🔧 Wallet info:', { 
        connected: wallet.connected, 
        publicKey: wallet.publicKey?.toString(),
        signTransaction: !!wallet.signTransaction 
      })
      
      // Generate a consistent switch ID (u64 for contract, string for Lit Protocol)
      const switchIdNumber = Date.now() // u64 for Solana contract
      const switchIdString = switchIdNumber.toString() // String for Lit Protocol PDA derivation
      console.log('🔧 Generated switch ID (number):', switchIdNumber, '(type:', typeof switchIdNumber, ')')
      console.log('🔧 Generated switch ID (string):', switchIdString, '(type:', typeof switchIdString, ')')
      console.log('🔧 ID validation:', {
        'is number': typeof switchIdNumber === 'number',
        'is integer': Number.isInteger(switchIdNumber),
        'is safe integer': Number.isSafeInteger(switchIdNumber),
        'is positive': switchIdNumber > 0
      })
      
      // Encrypt the message with Lit Protocol (pass string ID for PDA consistency)
      console.log('🔐 Encrypting message with Lit Protocol...')
      const encryptedData = await encryptMessage(message, switchIdString)
      console.log('✅ Message encrypted successfully, length:', encryptedData.encryptedString.length)

      // Create the switch on Solana (use number ID for u64 contract parameter)
      console.log('⛓️ Creating switch on Solana blockchain...')
      console.log('🔧 About to call createSwitch with:')
      console.log('  - switchId:', switchIdNumber, '(type:', typeof switchIdNumber, ')')
      console.log('  - encryptedString:', encryptedData.encryptedString.slice(0, 50) + '...', '(type:', typeof encryptedData.encryptedString, ', length:', encryptedData.encryptedString.length, ')')
      console.log('  - intervalSeconds:', intervalSeconds, '(type:', typeof intervalSeconds, ')')
      
      console.log('🔧 Final parameter validation before useProgram call:')
      console.log('  - All parameters are primitive types?', [
        typeof switchIdNumber === 'number',
        typeof encryptedData.encryptedString === 'string', 
        typeof intervalSeconds === 'number'
      ])
      
      const result = await createSwitch(switchIdNumber, encryptedData.encryptedString, intervalSeconds)
      console.log('✅ Switch created on Solana:', result)

      if (isMountedRef.current) {
        setTxSignature(result.signature)
        setSuccess(true)
        setShowToast(true)
        setMessage('')
        setInterval(24)
        
        // Auto-hide toast after 10 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setShowToast(false)
          }
        }, 10000)
      }
    } catch (err) {
      console.error('Failed to create switch:', err)
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to create switch')
      }
    } finally {
      if (isMountedRef.current) {
        setIsCreating(false)
      }
    }
  }

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="glassmorphism p-12">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">🔗</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Wallet Required</h1>
          <p className="text-white mb-6">
            Please connect your Solana wallet to create a dead man's switch.
          </p>
          <p className="text-sm text-white">
            We support Phantom, Solflare, and other popular Solana wallets.
          </p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="glassmorphism p-12">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Switch Created Successfully!</h1>
          <p className="text-white mb-4">
            Your dead man's switch has been created and encrypted. Remember to check in 
            regularly to reset the timer.
          </p>
          {txSignature && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
              <p className="text-green-400 text-sm mb-2">Transaction confirmed:</p>
              <button
                onClick={() => window.open(`https://solscan.io/tx/${txSignature}?cluster=devnet`, '_blank')}
                className="text-green-300 hover:text-green-200 underline text-sm break-all transition-colors"
              >
                {txSignature}
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setSuccess(false)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300"
            >
              Create Another
            </button>
            <button
              onClick={() => window.location.href = '/my-switches'}
              className="border border-purple-500/50 hover:border-purple-400 px-6 py-3 rounded-xl font-semibold text-white hover:bg-purple-500/10 transition-colors"
            >
              View My Switches
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Toast notification component
  const Toast = () => {
    if (!showToast || !txSignature) return null
    
    return (
      <div className="fixed top-4 right-4 z-50 animate-slide-in">
        <div className="bg-green-500/90 backdrop-blur-sm border border-green-400/50 rounded-lg p-4 shadow-xl max-w-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <span className="text-xl mr-2">✅</span>
                <h4 className="text-white font-semibold">Switch Created!</h4>
              </div>
              <p className="text-green-100 text-sm mb-3">
                Your dead man's switch was successfully created on Solana.
              </p>
              <button
                onClick={() => window.open(`https://solscan.io/tx/${txSignature}?cluster=devnet`, '_blank')}
                className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-md transition-colors inline-flex items-center"
              >
                <span className="mr-1">🔗</span>
                View on Solscan
              </button>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="text-green-200 hover:text-white ml-2 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Toast />
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Create Dead Man's Switch
          </span>
        </h1>
        <p className="text-white">
          Create an encrypted secret that will be automatically revealed if you don't check in.
        </p>
      </div>

      {/* Connection Status */}
      {connectionStatus && (
        <div className="glassmorphism p-4 mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400 mr-3"></div>
            <span className="text-purple-300">{connectionStatus}</span>
          </div>
        </div>
      )}





      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glassmorphism p-6">
          <label htmlFor="message" className="block text-sm font-medium text-white mb-2">
            Secret Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => {
              const newValue = e.target.value
              const byteLength = getMessageByteLength(newValue)
              
              // Allow typing but warn when approaching/exceeding limit
              setMessage(newValue)
              
              // Clear any existing errors when user starts typing within limits
              if (byteLength <= MAX_MESSAGE_SIZE && error?.includes('Message too large')) {
                setError(null)
              }
            }}
            placeholder="Enter your secret message here..."
            rows={6}
            className={`w-full px-4 py-3 bg-gray-800/50 border rounded-lg text-white placeholder-gray-400 focus:ring-1 transition-colors ${
              getMessageByteLength(message) > MAX_MESSAGE_SIZE 
                ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/50' 
                : getMessageByteLength(message) > MAX_MESSAGE_SIZE * 0.8
                ? 'border-yellow-500/70 focus:border-yellow-500 focus:ring-yellow-500/50'
                : 'border-gray-600/50 focus:border-purple-500 focus:ring-purple-500'
            }`}
            required
          />
          
          {/* Real-time validation feedback */}
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-white">
              This message will be encrypted and stored securely until the timer expires.
            </p>
            <div className="text-xs flex items-center space-x-2">
              <span className={`${
                getMessageByteLength(message) > MAX_MESSAGE_SIZE ? 'text-red-400' :
                getMessageByteLength(message) > MAX_MESSAGE_SIZE * 0.8 ? 'text-yellow-400' :
                'text-white'
              }`}>
                {getMessageByteLength(message)}/{MAX_MESSAGE_SIZE} bytes
              </span>
              {getMessageByteLength(message) > MAX_MESSAGE_SIZE && (
                <span className="text-red-400 font-medium">⚠️ Too large!</span>
              )}
              {getMessageByteLength(message) > MAX_MESSAGE_SIZE * 0.8 && getMessageByteLength(message) <= MAX_MESSAGE_SIZE && (
                <span className="text-yellow-400">⚠️ Near limit</span>
              )}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-2">
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  getMessageByteLength(message) > MAX_MESSAGE_SIZE ? 'bg-red-500' :
                  getMessageByteLength(message) > MAX_MESSAGE_SIZE * 0.8 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ 
                  width: `${Math.min((getMessageByteLength(message) / MAX_MESSAGE_SIZE) * 100, 100)}%` 
                }}
              />
            </div>
          </div>
        </div>

        <div className="glassmorphism p-6">
          <label htmlFor="interval" className="block text-sm font-medium text-white mb-2">
            Check-in Interval
          </label>
          <select
            id="interval"
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
          >
            {isFirstTimeUser && (
              <option value={1/60}>1 Minute (First-time users only)</option>
            )}
            <option value={1}>1 Hour</option>
            <option value={6}>6 Hours</option>
            <option value={12}>12 Hours</option>
            <option value={24}>24 Hours (1 Day)</option>
            <option value={72}>72 Hours (3 Days)</option>
            <option value={168}>1 Week</option>
            <option value={720}>1 Month</option>
          </select>
          <p className="text-xs text-white mt-2">
            How often you need to check in to keep your secret safe.
            {isFirstTimeUser && (
              <span className="block text-purple-300 mt-1">
                🎉 As a first-time user, you can try the 1-minute interval!
              </span>
            )}
          </p>
        </div>

        {error && (
          <div className="glassmorphism p-4 border-l-4 border-red-500">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="glassmorphism p-6">
          <h3 className="text-white font-semibold mb-4">📋 Summary</h3>
                      <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white">Message Length:</span>
              <span className={`${getMessageByteLength(message) > MAX_MESSAGE_SIZE ? 'text-red-400' : 'text-white'}`}>
                {message.length} characters ({getMessageByteLength(message)} bytes)
                {getMessageByteLength(message) > MAX_MESSAGE_SIZE && <span className="text-red-400 ml-1">⚠️ Exceeds limit</span>}
                {getMessageByteLength(message) > MAX_MESSAGE_SIZE * 0.9 && getMessageByteLength(message) <= MAX_MESSAGE_SIZE && <span className="text-yellow-400 ml-1">⚠️ Near limit</span>}
              </span>
            </div>
            <div className="flex justify-between">
                          <span className="text-white">Check-in Interval:</span>
            <span className="text-white">
              {interval === 1/60 ? '1 minute (60 seconds)' : `${interval} hours (${interval * 3600} seconds)`}
            </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white">Encryption:</span>
              <span className="text-green-400">✅ Lit Protocol</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white">Storage:</span>
              <span className="text-purple-400">⚡ Solana Blockchain</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isCreating || !message.trim() || getMessageByteLength(message) > MAX_MESSAGE_SIZE}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 px-8 py-4 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Creating Switch...
            </span>
          ) : (
            '🚀 Create Dead Man\'s Switch'
          )}
        </button>
      </form>

      <div className="mt-8 glassmorphism p-6">
        <h3 className="text-white font-semibold mb-3">🔒 How It Works</h3>
        <div className="space-y-3 text-sm text-white">
          <div className="flex items-start">
            <span className="text-purple-400 mr-2">1.</span>
            <span>Your message is encrypted locally using Lit Protocol before leaving your browser</span>
          </div>
          <div className="flex items-start">
            <span className="text-purple-400 mr-2">2.</span>
            <span>The encrypted data is stored on Solana blockchain with a timer</span>
          </div>
          <div className="flex items-start">
            <span className="text-purple-400 mr-2">3.</span>
            <span>You must check in before the timer expires to keep your secret safe</span>
          </div>
          <div className="flex items-start">
            <span className="text-purple-400 mr-2">4.</span>
            <span>If you don't check in, the secret becomes publicly viewable</span>
          </div>
        </div>
      </div>
    </div>
  )
}