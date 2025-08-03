import { FC, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PublicKey } from '@solana/web3.js'
import { useProgram } from '../hooks/useProgram'
import { useLitProtocol } from '../hooks/useLitProtocol'
import type { DeadManSwitch } from '../types'
import { safeBigIntToNumber, safeDateFromTimestamp, safeTimeCalculation } from '../types'

/*
  --------------------------------------------------------------------
  SwitchCard (public view)
  --------------------------------------------------------------------
  • Shows basic switch information for *any* switch on the network.
  • If the switch is expired *and* has stored data we allow users to
    decrypt the encrypted message using Lit Protocol.
  • Very similar to the card in `MySwitchesPage` but without the Ping
    button and with public-facing owner / decrypt controls.
*/
interface SwitchCardProps {
  switch_: {
    publicKey: PublicKey
    account: DeadManSwitch
  }
  onDecrypt: (switchPDA: string) => Promise<string | null>
  isDecrypting: boolean
}

const SwitchCard: FC<SwitchCardProps> = ({ switch_, onDecrypt, isDecrypting }) => {
  const { publicKey, account } = switch_

  // ──────────────────────────────────────────────────────────────────────────
  // ⏱  EXPIRATION CALCULATIONS (shared utility keeps things overflow-safe)
  // ──────────────────────────────────────────────────────────────────────────
  const { timeRemaining, isExpired } = safeTimeCalculation(
    account.lastPing,
    account.pingInterval
  )
  const isExpiringSoon = timeRemaining <= 3600 && timeRemaining > 0
  const lastPing = safeBigIntToNumber(account.lastPing)

  // Pretty formatting helpers (duplicated from MySwitchesPage for parity)
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'EXPIRED'
    const years = Math.floor(seconds / 31_536_000)
    const days  = Math.floor((seconds % 31_536_000) / 86_400)
    const hours = Math.floor((seconds % 86_400) / 3_600)
    const mins  = Math.floor((seconds % 3_600) / 60)
    if (years > 0)  return `${years}y ${days}d`
    if (days > 0)   return `${days}d ${hours}h`
    if (hours > 0)  return `${hours}h ${mins}m`
    if (mins > 0)   return `${mins}m`
    return '< 1m'
  }

  const getStatusBadge = () => {
    if (isExpired) return 'text-red-400 bg-red-900/20 border-red-500/30'
    if (isExpiringSoon) return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30'
    return 'text-green-400 bg-green-900/20 border-green-500/30'
  }

  // Decryption state (local per-card)
  const [decrypted, setDecrypted] = useState<string | null>(null)
  const [decryptError, setDecryptError] = useState<string | null>(null)

  const handleDecrypt = async () => {
    setDecryptError(null)
    try {
      const msg = await onDecrypt(publicKey.toString())
      setDecrypted(msg)
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : 'Decryption failed')
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-600">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <Link
            to={`/lock/${publicKey.toString()}`}
            className="text-lg font-semibold text-white hover:text-purple-300 transition-colors mb-1 block"
          >
            Switch {publicKey.toString().slice(0, 8)}
          </Link>
          <p className="text-sm text-gray-400">
            Owner: <a
              href={`https://solscan.io/account/${account.owner.toString()}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-purple-300"
            >
              {account.owner.toString().slice(0, 8)}…{account.owner.toString().slice(-4)}
            </a>
          </p>
          <p className="text-xs text-gray-400">
            Created: {safeDateFromTimestamp(account.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm border ${getStatusBadge()}`}>
          {isExpired ? 'EXPIRED' : 'ACTIVE'}
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Interval:</span>
          <p className="text-white">
            {safeBigIntToNumber(account.pingInterval) >= 86400
              ? `${Math.floor(safeBigIntToNumber(account.pingInterval) / 86400)} days`
              : `${Math.floor(safeBigIntToNumber(account.pingInterval) / 3600)} hours`}
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
          <span className="text-gray-400">Data Length:</span>
          <p className="text-white">{account.dataLength} bytes</p>
        </div>
      </div>

      {/* Decrypt section (only for switches marked as expired with data) */}
      {account.expired && account.dataLength > 0 && (
        <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-white font-medium">🔓 Unlock Secret Message</h4>
            <button
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {isDecrypting ? 'Decrypting…' : 'Decrypt Expired Message'}
            </button>
          </div>

          {decrypted && (
            <div className="bg-green-900/20 border border-green-500/30 rounded p-3 mt-3">
              <p className="text-green-300 text-sm font-semibold mb-1">🔓 Decrypted Message:</p>
              <p className="text-white break-words">{decrypted}</p>
            </div>
          )}

          {decryptError && (
            <div className="bg-red-900/20 border border-red-500/30 rounded p-3 mt-3">
              <p className="text-red-300 text-sm">❌ {decryptError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/*
  --------------------------------------------------------------------
  ViewLocksPage (public)
  --------------------------------------------------------------------
  A *much* simplified version inspired by `MySwitchesPage`. The goal is
  simply: fetch the latest switches (optionally limited to 16), display
  them, allow manual refresh, and provide decrypt controls.
*/
export const ViewLocksPage: FC = () => {
  const { getAllSwitches } = useProgram()
  const { decryptMessage } = useLitProtocol()

  const [switches, setSwitches] = useState<Array<{ publicKey: PublicKey; account: DeadManSwitch }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decryptingSwitch, setDecryptingSwitch] = useState<string | null>(null)

  const loadSwitches = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const latest = await getAllSwitches(16) // fetch and limit to 16 newest
      setSwitches(latest as any)
      setHasLoadedOnce(true)
    } catch (err) {
      console.error('Failed to load switches:', err)
      setError(err instanceof Error ? err.message : 'Failed to load switches')
    } finally {
      setIsLoading(false)
    }
  }, [getAllSwitches])

  // Initial automatic load
  useEffect(() => {
    if (!hasLoadedOnce && !isLoading) {
      loadSwitches()
    }
  }, [hasLoadedOnce, isLoading, loadSwitches])

  // Decrypt handler shared by cards
  const handleDecrypt = async (switchPDA: string): Promise<string | null> => {
    setDecryptingSwitch(switchPDA)
    try {
      const switchAccount = switches.find(
        (s) => s.publicKey.toString() === switchPDA
      );
      if (!switchAccount) {
        throw new Error('Switch data not found locally');
      }
      const encryptedData = new Uint8Array(switchAccount.account.encryptedData);
      return await decryptMessage(
        encryptedData,
        undefined,
        undefined,
        switchAccount.account.owner.toString()
      );
    } finally {
      setDecryptingSwitch(null)
    }
  }

  // Quick stats (derived)
  const expiredCount = switches.filter(s => {
    const calc = safeTimeCalculation(s.account.lastPing, s.account.pingInterval)
    return calc.isExpired
  }).length
  const activeCount = switches.filter(s => {
    const calc = safeTimeCalculation(s.account.lastPing, s.account.pingInterval)
    return !calc.isExpired
  }).length

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">View All Locks</h1>
        <button
          onClick={loadSwitches}
          disabled={isLoading}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          {isLoading ? 'Loading…' : hasLoadedOnce ? 'Refresh' : 'Load Locks'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-red-300">
          {error}
        </div>
      )}

      {/* Content */}
      {switches.length > 0 ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
            <div className="glassmorphism p-4">
              <p className="text-2xl font-bold text-purple-400">{switches.length}</p>
              <p className="text-sm text-gray-300">Latest Switches</p>
            </div>
            <div className="glassmorphism p-4">
              <p className="text-2xl font-bold text-green-400">{activeCount}</p>
              <p className="text-sm text-gray-300">Active</p>
            </div>
            <div className="glassmorphism p-4">
              <p className="text-2xl font-bold text-red-400">{expiredCount}</p>
              <p className="text-sm text-gray-300">Expired</p>
            </div>
          </div>

          {/* Switch grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {switches.map(s => (
              <SwitchCard
                key={s.publicKey.toString()}
                switch_={s}
                onDecrypt={handleDecrypt}
                isDecrypting={decryptingSwitch === s.publicKey.toString()}
              />
            ))}
          </div>
        </>
      ) : isLoading ? (
        <div className="text-center py-12">
          <div className="glassmorphism p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-white">Loading switches…</p>
          </div>
        </div>
      ) : hasLoadedOnce ? (
        <div className="text-center py-12">
          <div className="glassmorphism p-8">
            <h3 className="text-xl font-semibold text-white mb-4">No Switches Found</h3>
            <p className="text-white mb-6">There are no dead man’s switches on the network yet.</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="glassmorphism p-8">
            <button
              onClick={loadSwitches}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Loading…' : '🔍 Load Switches'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
