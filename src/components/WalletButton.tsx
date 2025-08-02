import { FC } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

/**
 * Enhanced wallet connection button with status display.
 * 
 * This component wraps the standard Solana wallet adapter button with
 * additional features:
 * - Loading state during connection attempts
 * - Public key display for connected wallets (truncated format)
 * - Consistent styling with application theme
 * - Auto-detection of wallet connection status
 * 
 * Shows different UI states based on connection status:
 * - Connecting: Shows loading spinner
 * - Connected: Shows truncated public key + disconnect button
 * - Disconnected: Shows connect wallet button
 * 
 * @returns JSX element with wallet connection interface
 */
export const WalletButton: FC = () => {
  const { connected, connecting, publicKey } = useWallet()

  if (connecting) {
    return (
      <button disabled className="wallet-adapter-button">
        Connecting...
      </button>
    )
  }

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-green-400 text-sm">
          {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
        </span>
        <WalletMultiButton />
      </div>
    )
  }

  return <WalletMultiButton />
}