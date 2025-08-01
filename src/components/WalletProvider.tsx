import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import { getConfig } from '../lib/config'

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css'

interface Props {
  children: ReactNode
}

export const AppWalletProvider: FC<Props> = ({ children }) => {
  const config = getConfig()
  
  // Configure the network
  const network = config.SOLANA_NETWORK as WalletAdapterNetwork
  const endpoint = useMemo(() => {
    if (config.SOLANA_RPC_URL) {
      return config.SOLANA_RPC_URL
    }
    return clusterApiUrl(network)
  }, [network, config.SOLANA_RPC_URL])

  // Configure wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}