import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useLitProtocol } from '../hooks/useLitProtocol'
import { useProgram } from '../hooks/useProgram'
import { SwitchCard } from './SwitchCard'

interface Switch {
  publicKey: string
  account: {
    owner: any
    lastPing: number
    pingInterval: number
    encryptedData: number[]
    dataLength: number
    createdAt: number
    bump: number
    expired: boolean
  }
  computed: {
    isExpired: boolean
    expirationTime: number
    timeSinceExpiry: number
    timeUntilExpiry: number
  }
}

export function SwitchList() {
  const { publicKey } = useWallet()
  const { connected } = useLitProtocol()
  const { getUserSwitches, getActualEncryptedData, connected: programConnected } = useProgram()
  const [switches, setSwitches] = useState<Switch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ready' | 'expired' | 'active'>('all')

  // Fetch real switches from the blockchain
  useEffect(() => {
    const fetchUserSwitches = async () => {
      if (!connected || !publicKey || !programConnected) {
        setSwitches([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        console.log('🔍 Fetching user switches from blockchain...')
        const userSwitches = await getUserSwitches()
        console.log('✅ Found', userSwitches.length, 'switches for user')
        
        // The switches come with computed properties already
        setSwitches(userSwitches)
      } catch (err) {
        console.error('❌ Failed to fetch user switches:', err)
        setError(err instanceof Error ? err.message : 'Failed to load switches')
        setSwitches([])
      } finally {
        setLoading(false)
      }
    }

    fetchUserSwitches()
  }, [connected, publicKey, programConnected, getUserSwitches])

  // Filter switches based on their status
  const getFilteredSwitches = () => {
    if (!connected || switches.length === 0) return []

    // Use the computed properties that come with the switches
    const switchesWithStatus = switches.map((switchItem) => ({
      ...switchItem,
      // Use computed properties from useProgram
      shouldBeExpired: switchItem.computed.isExpired && !switchItem.account.expired,
      isExpiredOnChain: switchItem.account.expired,
      timeBasedExpired: switchItem.computed.isExpired
    }))

    switch (filter) {
      case 'ready':
        return switchesWithStatus.filter(s => s.shouldBeExpired || s.isExpiredOnChain)
      case 'expired':
        return switchesWithStatus.filter(s => s.isExpiredOnChain)
      case 'active':
        return switchesWithStatus.filter(s => !s.shouldBeExpired && !s.isExpiredOnChain)
      default:
        return switchesWithStatus
    }
  }

  const [filteredSwitches, setFilteredSwitches] = useState<any[]>([])

  useEffect(() => {
    const filtered = getFilteredSwitches()
    setFilteredSwitches(filtered)
  }, [switches, filter, connected])

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Dead Man's Switches</h2>
          <p className="text-gray-600 mb-6">Connect your wallet to view your switches</p>
          <div className="p-6 border rounded-lg bg-gray-50">
            <p className="text-gray-500">Wallet connection required</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Dead Man's Switches</h2>
        
        {/* Filter Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          {[
            { key: 'all', label: 'All Switches', icon: '📋' },
            { key: 'ready', label: 'Ready to Decrypt', icon: '⚡' },
            { key: 'expired', label: 'Expired', icon: '🔴' },
            { key: 'active', label: 'Active', icon: '🟢' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <h3 className="font-medium text-red-900 mb-2">Failed to load switches</h3>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading switches from blockchain...</p>
          </div>
        )}

        {/* Switch Cards */}
        {!loading && (
          <div className="space-y-6">
            {filteredSwitches.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔒</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {filter === 'all' ? 'No switches found' : `No ${filter} switches`}
                </h3>
                <p className="text-gray-600">
                  {filter === 'all' 
                    ? 'Create your first dead man\'s switch to get started'
                    : `No switches match the ${filter} filter`
                  }
                </p>
              </div>
            ) : (
              filteredSwitches.map((switchItem) => {
                // Extract actual encrypted data from the account
                const encryptedData = getActualEncryptedData(switchItem.account)
                
                // Use the full PDA public key as the switch ID since we need it for PDA derivation
                const switchPDA = switchItem.publicKey
                
                // Create a short display ID for the title
                const displayId = switchPDA.slice(-8)
                
                // Generate a readable title based on creation time
                const createdDate = new Date(switchItem.account.createdAt * 1000)
                const title = `Switch ${displayId}`
                const description = `Created ${createdDate.toLocaleDateString()}`
                
                return (
                  <SwitchCard
                    key={switchPDA}
                    switchId={switchPDA} // Pass full PDA as switchId
                    ownerPubkey={switchItem.account.owner.toString()}
                    encryptedData={encryptedData}
                    title={title}
                    description={description}
                  />
                )
              })
            )}
          </div>
        )}

        {/* Summary Stats */}
        {!loading && !error && switches.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{switches.length}</div>
              <div className="text-sm text-gray-600">Total Switches</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {switches.filter(s => s.computed.isExpired && !s.account.expired).length}
              </div>
              <div className="text-sm text-gray-600">Ready to Mark</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {switches.filter(s => s.account.expired).length}
              </div>
              <div className="text-sm text-gray-600">Expired</div>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">💡 How it works:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>🟢 Active:</strong> Switch is running normally, ping regularly to keep it alive</li>
            <li><strong>🟡 Ready to Mark:</strong> Time has expired, click "Mark Expired & Decrypt" to unlock</li>
            <li><strong>🔴 Expired:</strong> Switch is marked as expired, message can be decrypted</li>
            <li><strong>⚡ One-Click:</strong> "Mark Expired & Decrypt" does both operations seamlessly</li>
          </ul>
        </div>
      </div>
    </div>
  )
}