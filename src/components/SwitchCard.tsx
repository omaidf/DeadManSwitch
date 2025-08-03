import React, { useState, useEffect } from 'react'
import { useLitProtocol } from '../hooks/useLitProtocol'

interface SwitchCardProps {
  switchId: string
  ownerPubkey: string
  encryptedData: Uint8Array
  title?: string
  description?: string
}

interface SwitchData {
  expirationTime: number
  expired: boolean
  lastPing: number
  pingInterval: number
  shouldBeExpired: boolean
}

export function SwitchCard({ 
  switchId, 
  ownerPubkey, 
  encryptedData, 
  title = "Dead Man's Switch",
  description = "Encrypted message"
}: SwitchCardProps) {
  const {
    fetchSwitchDataByPDA,
    markExpiredAndDecryptByPDA,
    decryptMessage,
    connected
  } = useLitProtocol()

  const [switchData, setSwitchData] = useState<SwitchData | null>(null)
  const [loading, setLoading] = useState(false)
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [canMarkExpired, setCanMarkExpired] = useState(false)

  // Fetch switch data on mount and periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchSwitchDataByPDA(switchId) // switchId is now the PDA
        setSwitchData(data)

        // For checking if we can mark as expired, we still need to construct this
        // Since checkShouldMarkExpired expects numeric switchId, we'll use the PDA directly
        setCanMarkExpired(data.shouldBeExpired && !data.expired)
      } catch (err) {
        console.error('Failed to fetch switch data:', err)
        setError('Failed to load switch data')
      }
    }

    if (connected) {
      fetchData()
      // Update every 30 seconds
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [connected, switchId, ownerPubkey, fetchSwitchDataByPDA])

  const handleMarkExpiredAndDecrypt = async () => {
    if (!switchData) return

    setLoading(true)
    setError(null)

    try {
      console.log('🎯 User clicked Mark Expired & Decrypt button')
      const message = await markExpiredAndDecryptByPDA(encryptedData, switchId, ownerPubkey)
      setDecryptedMessage(message)
      
      // Refresh switch data to show new status
      const updatedData = await fetchSwitchDataByPDA(switchId)
      setSwitchData(updatedData)
      setCanMarkExpired(false) // Should be false now since it's expired
    } catch (err) {
      console.error('Failed to mark expired and decrypt:', err)
      setError(err instanceof Error ? err.message : 'Failed to decrypt message')
    } finally {
      setLoading(false)
    }
  }

  const handleDecryptOnly = async () => {
    if (!switchData) return

    setLoading(true)
    setError(null)

    try {
      console.log('🎯 User clicked Decrypt button (already expired)')
      const message = await decryptMessage(encryptedData, undefined, switchId, ownerPubkey)
      setDecryptedMessage(message)
    } catch (err) {
      console.error('Failed to decrypt:', err)
      setError(err instanceof Error ? err.message : 'Failed to decrypt message')
    } finally {
      setLoading(false)
    }
  }

  const formatTimeRemaining = (expirationTime: number): string => {
    const now = Date.now() / 1000
    const timeLeft = expirationTime - now

    if (timeLeft <= 0) return "Expired"

    const days = Math.floor(timeLeft / (24 * 60 * 60))
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60)

    if (days > 0) return `${days}d ${hours}h remaining`
    if (hours > 0) return `${hours}h ${minutes}m remaining`
    return `${minutes}m remaining`
  }

  const getStatusColor = () => {
    if (!switchData) return 'bg-gray-100'
    if (switchData.expired) return 'bg-red-100 border-red-300'
    if (switchData.shouldBeExpired) return 'bg-yellow-100 border-yellow-300'
    return 'bg-green-100 border-green-300'
  }

  const getStatusText = () => {
    if (!switchData) return 'Loading...'
    if (switchData.expired) return 'Expired & Ready to Decrypt'
    if (switchData.shouldBeExpired) return 'Should be Expired - Ready to Mark'
    return 'Active'
  }

  if (!connected) {
    return (
      <div className="p-6 border rounded-lg bg-gray-50">
        <p className="text-gray-600">Please connect your wallet to view switches</p>
      </div>
    )
  }

  return (
    <div className={`p-6 border rounded-lg ${getStatusColor()}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
            <p className="text-xs text-gray-500 mt-1">ID: {switchId}</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-white">
              {getStatusText()}
            </span>
          </div>
        </div>

        {/* Switch Details */}
        {switchData && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium">
                {switchData.expired ? '🔴 Expired' : 
                 switchData.shouldBeExpired ? '🟡 Should be expired' : '🟢 Active'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">
                {formatTimeRemaining(switchData.expirationTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Ping:</span>
              <span className="font-medium">
                {new Date(switchData.lastPing * 1000).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Decrypted Message */}
        {decryptedMessage && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-medium text-blue-900 mb-2">🔓 Decrypted Message:</h4>
            <div className="text-blue-800 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {decryptedMessage}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {/* Show different buttons based on switch state */}
          
          {/* Case 1: Already marked as expired - just decrypt */}
          {switchData?.expired && !decryptedMessage && (
            <button
              onClick={handleDecryptOnly}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '🔄 Decrypting...' : '🔓 Decrypt Expired Message'}
            </button>
          )}

          {/* Case 2: Should be expired but not marked yet - mark and decrypt */}
          {switchData?.shouldBeExpired && !switchData.expired && (
            <button
              onClick={handleMarkExpiredAndDecrypt}
              disabled={loading}
              className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '🔄 Processing...' : '⚡ Mark Expired & Decrypt'}
            </button>
          )}

          {/* Case 3: Still active - not ready */}
          {switchData && !switchData.shouldBeExpired && !switchData.expired && (
            <button
              disabled
              className="flex-1 bg-gray-300 text-gray-500 px-4 py-2 rounded-lg cursor-not-allowed"
            >
              ⏰ Not Ready to Decrypt
            </button>
          )}

          {/* Refresh button */}
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            🔄
          </button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 pt-2">
          {switchData?.shouldBeExpired && !switchData.expired && (
            <p>💡 This switch has expired but hasn't been marked yet. Click "Mark Expired & Decrypt" to unlock the message in one step.</p>
          )}
          {switchData?.expired && !decryptedMessage && (
            <p>💡 This switch is marked as expired. Click "Decrypt Expired Message" to reveal the content.</p>
          )}
          {!switchData?.shouldBeExpired && !switchData?.expired && (
            <p>💡 This switch is still active. It will be ready to decrypt {switchData ? formatTimeRemaining(switchData.expirationTime) : ''}.</p>
          )}
        </div>
      </div>
    </div>
  )
}