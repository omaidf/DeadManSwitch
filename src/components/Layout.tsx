import { FC, ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from './WalletButton'
import { NetworkAlert } from './NetworkAlert'

interface Props {
  children: ReactNode
}

const navigation = [
  {
    name: 'Home',
    href: '/',
    icon: '🏠',
    description: 'Landing page'
  },
  {
    name: 'Create Switch',
    href: '/create',
    icon: '➕',
    description: 'Create new dead man switch',
    requiresWallet: true
  },
  {
    name: 'My Switches',
    href: '/my-switches',
    icon: '🔒',
    description: 'View your switches',
    requiresWallet: true
  },
  {
    name: 'View Locks',
    href: '/view-locks',
    icon: '🔍',
    description: 'Browse all switches and unlocks'
  },
  {
    name: 'About',
    href: '/about',
    icon: 'ℹ️',
    description: 'About this project'
  },
  {
    name: 'Help',
    href: '/help',
    icon: '🆘',
    description: 'Wallet / network help'
  }
]

/**
 * Main layout component that provides the application's UI structure.
 * 
 * This component creates the overall application layout with:
 * - Responsive sidebar navigation with mobile support
 * - Wallet connection button in the header
 * - Network alert system for connection issues
 * - Consistent spacing and styling throughout
 * - Route-aware navigation highlighting
 * 
 * Features:
 * - Mobile-responsive sidebar with overlay
 * - Wallet-aware navigation (some routes require connection)
 * - Network status monitoring and alerts
 * - Gradient background and glassmorphism effects
 * - Social links and branding in sidebar footer
 * 
 * @param props - Component props
 * @param props.children - Page content to render in the main area
 * @returns JSX element with complete application layout
 */
export const Layout: FC<Props> = ({ children }) => {
  const location = useLocation()
  const { connected } = useWallet()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  /**
   * Determines if a navigation link should be highlighted as active.
   * 
   * Compares the current route path with the navigation item's href
   * to determine active state. Handles special case for home route
   * to ensure exact matching.
   * 
   * @param href - The navigation item's href to check
   * @returns Boolean indicating if the route is currently active
   */
  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800/80 backdrop-blur-sm rounded-lg border border-purple-500/20 text-white hover:bg-gray-700/80 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Layout with sidebar */}
      <div className="flex h-screen">
        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`
          fixed top-0 left-0 h-full w-80 bg-gray-900/95 backdrop-blur-md border-r border-purple-500/20 z-50 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:static lg:transform-none
        `}>
          {/* Header */}
          <div className="p-6 border-b border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">💀</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    DeadMan on Sol
                  </h1>
                  <p className="text-xs text-gray-400">Decentralized Secrets</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              const canAccess = !item.requiresWallet || connected
              
              return (
                <Link
                  key={item.href}
                  to={canAccess ? item.href : '#'}
                  onClick={() => {
                    if (canAccess) {
                      setSidebarOpen(false)
                    }
                  }}
                  className={`
                    group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200
                    ${canAccess ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                    ${isActive(item.href) && canAccess
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-white shadow-lg' 
                      : canAccess 
                        ? 'hover:bg-gray-800/50 text-gray-300 hover:text-white' 
                        : 'text-gray-500'
                    }
                  `}
                >
                  <span className="text-2xl flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{item.name}</div>
                    <div className="text-xs text-gray-400 truncate">{item.description}</div>
                    {item.requiresWallet && !connected && (
                      <div className="text-xs text-red-400">Wallet required</div>
                    )}
                  </div>
                  {isActive(item.href) && canAccess && (
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Network Alert above Footer */}
          <div className="absolute bottom-20 left-0 right-0 p-4">
            <NetworkAlert />
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700/50">
            <div className="text-center">
              <p className="text-xs text-gray-500">Built on Solana</p>
              <div className="flex justify-center space-x-4 mt-2">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <span className="text-lg">🐙</span>
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <span className="text-lg">🐦</span>
                </a>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <span className="text-lg">💬</span>
                </a>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main content */}
        <div className="flex-1 flex flex-col lg:ml-0 overflow-hidden">
          {/* Top bar with wallet */}
          <header className="bg-black/20 backdrop-blur-sm border-b border-purple-500/20 p-4">
            <div className="flex justify-between items-center">
              <div className="lg:hidden"></div> {/* Spacer for mobile */}
              <div className="ml-auto">
                <WalletButton />
              </div>
            </div>
          </header>
          
          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}