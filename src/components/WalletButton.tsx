import { FC } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

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