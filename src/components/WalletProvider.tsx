import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import { getConfig } from '../lib/config'

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css'
import '@solana/wallet-adapter-react-ui/styles.css'

interface Props {
  children: ReactNode
}

/**
 * Application-wide wallet provider component that configures Solana wallet integration.
 * 
 * This component wraps the entire application with Solana wallet functionality,
 * providing wallet connection, transaction signing, and network configuration.
 * It sets up the wallet adapter with support for popular Solana wallets and
 * configures the RPC endpoint based on environment variables.
 * 
 * Features:
 * - Automatic wallet detection and connection
 * - Support for Phantom and Solflare wallets
 * - Network-aware RPC endpoint configuration
 * - Modal UI for wallet selection
 * - Auto-connect functionality for better UX
 * 
 * @param props - Component props containing children to wrap
 * @param props.children - React nodes to wrap with wallet functionality
 * @returns JSX element with complete wallet provider setup
 */
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