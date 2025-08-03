import { FC } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { NetworkStatus } from '../components/NetworkStatus'
import { FaGithub, FaTwitter, FaFilePdf } from 'react-icons/fa'

/**
 * Landing page component that introduces the Dead Man's Switch application.
 * 
 * This is the main entry point that provides:
 * - Hero section with application introduction and call-to-action
 * - Feature explanation with step-by-step process
 * - Technology stack information (Solana + Lit Protocol)
 * - Network statistics and usage metrics
 * - Quick action cards for authenticated users
 * - Comprehensive call-to-action section
 * 
 * The page adapts its content based on wallet connection status,
 * showing different CTAs and navigation options for connected vs
 * disconnected users.
 * 
 * @returns JSX element containing the complete homepage layout
 */
export const HomePage: FC = () => {
  const { connected } = useWallet()

  return (
    <div className="min-h-full">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-pink-900/20"></div>
        <div className="relative px-6 py-16 sm:py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                DeadMan on Sol
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-white max-w-3xl mx-auto">
              Create encrypted secrets that automatically reveal when you're away. 
              A decentralized, trustless system built on Solana blockchain that ensures 
              your important information reaches the right people at the right time.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              {connected ? (
                <Link
                  to="/create"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8 py-3 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  🚀 Create Your First Switch
                </Link>
              ) : (
                <div className="text-center">
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 px-8 py-3 rounded-xl">
                    <span className="text-white font-semibold">Connect your wallet to get started</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">Phantom, Solflare, and other Solana wallets supported</p>
                </div>
              )}
              <Link
                to="/view-locks"
                className="text-gray-300 hover:text-white font-semibold flex items-center space-x-2 transition-colors"
              >
                <span>🔍 View All Locks</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Social Links Section */}
      <div className="py-12 sm:py-16 text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl mb-4">
          Join the Community
        </h2>
                  <p className="text-lg text-white mb-8">
          Follow us on social media and check out our whitepaper.
        </p>
        <div className="flex justify-center space-x-8">
          <a href="https://github.com/0xWizzzz/DeadManSwitch" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
            <FaGithub className="w-10 h-10 text-purple-400 hover:text-purple-300" />
          </a>
          <a href="https://x.com/deadmanonsol" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
            <FaTwitter className="w-10 h-10 text-sky-400 hover:text-sky-300" />
          </a>
          <a href="/whitepaper.pdf" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
            <FaFilePdf className="w-10 h-10 text-red-400 hover:text-red-300" />
          </a>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 sm:py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-white">
            Three simple steps to secure your secrets
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Step 1 */}
          <div className="glassmorphism p-8 text-center group hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">1. Encrypt Your Secret</h3>
            <p className="text-gray-300">
              Your message is encrypted client-side before ever leaving your browser. 
              Complete privacy guaranteed.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glassmorphism p-8 text-center group hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">⏰</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">2. Set Timer</h3>
            <p className="text-gray-300">
              Choose when your secret should be revealed - from 1 hour to 1 month. 
              Reset anytime to keep it secure.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glassmorphism p-8 text-center group hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🔓</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">3. Automatic Reveal</h3>
            <p className="text-gray-300">
              If you don't reset the timer, your secret automatically becomes 
              publicly viewable. Trustless and reliable.
            </p>
          </div>
        </div>
      </div>

      {/* Roadmap Section */}
      <div className="py-16 sm:py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Development Roadmap
          </h2>
          <p className="mt-4 text-lg text-white">
            Our journey to complete decentralization
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Phase 1 */}
          <div className="glassmorphism p-8 text-center group hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">✅</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Phase 1</h3>
            <p className="text-green-400 font-semibold mb-2">COMPLETED</p>
            <p className="text-gray-300">
              Launch on DevNet
            </p>
          </div>

          {/* Phase 2 - Current */}
          <div className="glassmorphism p-8 text-center group hover:scale-105 transition-transform duration-300 border-2 border-purple-400/50 shadow-lg shadow-purple-400/20">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🔄</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Phase 2</h3>
            <p className="text-purple-400 font-bold text-lg mb-2">CURRENT PHASE</p>
            <p className="text-gray-300">
              <strong>Apply for Lit Protocol Grant</strong>
            </p>
          </div>

          {/* Phase 3 */}
          <div className="glassmorphism p-8 text-center group hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🚀</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Phase 3</h3>
            <p className="text-blue-400 font-semibold mb-2">UPCOMING</p>
            <p className="text-gray-300">
              Launch on Mainnet
            </p>
          </div>

          {/* Phase 4 */}
          <div className="glassmorphism p-8 text-center group hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🌐</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-4">Phase 4</h3>
            <p className="text-orange-400 font-semibold mb-2">FUTURE</p>
            <p className="text-gray-300">
              100% decentralization on IPFS - similar to Tornado Cash
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="py-16 sm:py-24 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-y border-purple-500/20">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-12">Network Statistics</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400 mb-2">42</div>
              <div className="text-gray-300">Active Switches</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">7</div>
              <div className="text-gray-300">Revealed Today</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">156</div>
              <div className="text-gray-300">Total Users</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions for Connected Users */}
      {connected && (
        <div className="py-16 sm:py-24">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Link
              to="/create"
              className="glassmorphism p-6 hover:scale-105 transition-all duration-300 group"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <span className="text-xl">➕</span>
                </div>
                <h4 className="text-lg font-semibold text-white">Create Switch</h4>
              </div>
              <p className="text-gray-300">Set up a new dead man's switch with your secret message</p>
            </Link>
            
            <Link
              to="/my-switches"
              className="glassmorphism p-6 hover:scale-105 transition-all duration-300 group"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <span className="text-xl">🔒</span>
                </div>
                <h4 className="text-lg font-semibold text-white">My Switches</h4>
              </div>
              <p className="text-gray-300">Manage and monitor your active switches</p>
            </Link>
            
            <Link
              to="/view-locks"
              className="glassmorphism p-6 hover:scale-105 transition-all duration-300 group"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <span className="text-xl">🔍</span>
                </div>
                <h4 className="text-lg font-semibold text-white">View All Locks</h4>
              </div>
              <p className="text-gray-300">Browse all switches and unlock expired messages</p>
            </Link>
          </div>
        </div>
      )}

      {/* CTA Section */}
      <div className="py-16 sm:py-24">
        <div className="glassmorphism p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to Secure Your Secrets?
          </h2>
          <p className="text-lg text-white mb-8 max-w-2xl mx-auto">
            Join the decentralized revolution in secret management. Create your first 
            dead man's switch today and experience true digital security.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {connected ? (
              <>
                <Link
                  to="/create"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8 py-3 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  Create Switch
                </Link>
                <Link
                  to="/my-switches"
                  className="border border-purple-500/50 hover:border-purple-400 px-8 py-3 rounded-xl font-semibold text-white hover:bg-purple-500/10 transition-colors"
                >
                  View My Switches
                </Link>
              </>
            ) : (
              <div className="text-center">
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 px-8 py-3 rounded-xl mb-2">
                  <span className="text-white font-semibold">Connect Wallet to Continue</span>
                </div>
                <p className="text-sm text-gray-400">Use the wallet button in the top right</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Network Status Section */}
      <div className="py-8">
        <div className="max-w-md mx-auto">
          <NetworkStatus />
        </div>
      </div>
    </div>
  )
}