import { FC } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppWalletProvider } from './components/WalletProvider'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HomePage } from './pages/HomePage'
import { CreatePage } from './pages/CreatePage'
import { MySwitchesPage } from './pages/MySwitchesPage'
import { ViewLocksPage } from './pages/ViewLocksPage'
import { LockDetailsPage } from './pages/LockDetailsPage'

/**
 * Help page component that displays instructions for using the Dead Man's Switch application.
 * Provides step-by-step guidance on wallet connection, switch creation, check-ins, and message revelation.
 * 
 * @returns JSX element containing the help documentation
 */
const HelpPage: FC = () => (
  <div className="max-w-4xl mx-auto">
    <h1 className="text-3xl font-bold text-white mb-4">Help</h1>
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-4">How to use Dead Man's Switch</h2>
      <div className="space-y-4 text-gray-300">
        <div>
          <h3 className="font-semibold text-white mb-2">1. Connect Your Wallet</h3>
          <p>Connect your Solana wallet (Phantom or Solflare) to get started.</p>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-2">2. Create a Switch</h3>
          <p>Write your secret message and choose how often you want to check in.</p>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-2">3. Check In Regularly</h3>
          <p>Reset your timer before it expires to keep your message secret.</p>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-2">4. Message Revealed</h3>
          <p>If you don't check in, your message will be automatically revealed to the public.</p>
        </div>
      </div>
    </div>
  </div>
)

/**
 * About page component that provides information about the Dead Man's Switch dApp.
 * Explains the application's purpose, technology stack, and core functionality.
 * Includes details about Solana blockchain integration and Lit Protocol encryption.
 * 
 * @returns JSX element containing the about information
 */
const AboutPage: FC = () => (
  <div className="max-w-4xl mx-auto">
    <h1 className="text-3xl font-bold text-white mb-4">About</h1>
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">DeadMan on Sol</h2>
        <p className="text-gray-300 mb-4">
          A decentralized application built on the Solana blockchain that allows users to create 
          time-locked encrypted secrets. If the user fails to check in within a specified time 
          interval, the secret is automatically revealed.
        </p>
        <p className="text-gray-300">
          This system uses Lit Protocol for encryption and Solana for decentralized storage 
          and timing mechanisms.
        </p>
      </div>
      
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Technology Stack</h3>
        <ul className="space-y-2 text-gray-300">
          <li>• <strong>Solana:</strong> Blockchain for storage and smart contracts</li>
          <li>• <strong>Lit Protocol:</strong> Decentralized encryption and access control</li>
          <li>• <strong>React:</strong> Frontend framework</li>
          <li>• <strong>Vite:</strong> Build tool and development server</li>
          <li>• <strong>Tailwind CSS:</strong> Styling</li>
        </ul>
      </div>
    </div>
  </div>
)

/**
 * 404 Not Found page component for handling invalid routes.
 * Displays a user-friendly error message and provides navigation back to home.
 * 
 * @returns JSX element with 404 error content and home navigation
 */
const NotFoundPage: FC = () => (
  <div className="max-w-2xl mx-auto text-center">
    <h1 className="text-4xl font-bold text-white mb-4">404</h1>
    <p className="text-gray-300 mb-8">Page not found</p>
    <a href="/" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors">
      Go Home
    </a>
  </div>
)

/**
 * Main application component that sets up routing and global providers.
 * 
 * Wraps the entire application with:
 * - ErrorBoundary for error handling
 * - AppWalletProvider for Solana wallet integration
 * - Layout component for consistent UI structure
 * - React Router for client-side navigation
 * 
 * Defines all application routes including:
 * - Home page (/)
 * - Create switch (/create)
 * - My switches (/my-switches)
 * - View locks (/view-locks)
 * - Lock details (/lock/:lockId)
 * - Help and About pages
 * - 404 fallback for invalid routes
 * 
 * @returns The complete application JSX structure
 */
const App: FC = () => {
  return (
    <ErrorBoundary>
      <AppWalletProvider>
        <Layout>
          <Routes>
                          <Route path="/" element={<HomePage />} />
              <Route path="/create" element={<CreatePage />} />
              <Route path="/my-switches" element={<MySwitchesPage />} />
              <Route path="/view-locks" element={<ViewLocksPage />} />
              <Route path="/lock/:lockId" element={<LockDetailsPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </AppWalletProvider>
    </ErrorBoundary>
  )
}

export default App