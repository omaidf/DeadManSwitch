import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 * 
 * This React class component implements error boundaries to gracefully handle
 * runtime errors that would otherwise crash the application. It provides:
 * - Error catching and state management
 * - User-friendly error display with recovery options
 * - Development mode error details for debugging
 * - Fallback UI with navigation options
 * 
 * The error boundary catches errors during rendering, in lifecycle methods,
 * and in constructors of the whole tree below them.
 */
export class ErrorBoundary extends Component<Props, State> {
  /**
   * Initializes the error boundary with default state.
   * 
   * @param props - Component props containing children to protect
   */
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  /**
   * Static lifecycle method called when an error is thrown during rendering.
   * 
   * This method is called during the "render" phase, so side effects are not permitted.
   * Updates the component state to trigger the error UI on the next render.
   * 
   * @param error - The error that was thrown
   * @returns New state object to trigger error UI
   */
  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  /**
   * Lifecycle method called when an error is caught by the error boundary.
   * 
   * This method is called during the "commit" phase, so side effects are permitted.
   * Used for logging errors and updating state with detailed error information.
   * 
   * @param error - The error that was thrown
   * @param errorInfo - Object containing component stack trace information
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error caught by ErrorBoundary:', error)
    console.error('🚨 Error info:', errorInfo)
    
    this.setState({
      error,
      errorInfo
    })
  }

  /**
   * Renders either the error fallback UI or the children components.
   * 
   * When an error is caught, displays a comprehensive error page with:
   * - User-friendly error message
   * - Recovery options (reload page, go home)
   * - Development mode error details (stack trace, component stack)
   * - Styled error UI consistent with application design
   * 
   * @returns Error UI if error occurred, otherwise renders children normally
   */
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="glassmorphism p-8 border border-red-500/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">🚨</span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
              <p className="text-gray-300 mb-6">
                An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
              </p>
              
              {import.meta.env.DEV && this.state.error && (
                <details className="text-left bg-red-900/20 rounded-lg p-4 mb-4">
                  <summary className="text-red-300 font-semibold cursor-pointer mb-2">
                    Error Details (Development Mode)
                  </summary>
                  <div className="text-sm text-red-200 space-y-2">
                    <div>
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    <div>
                      <strong>Stack:</strong>
                      <pre className="text-xs mt-1 overflow-auto max-h-32">
                        {this.state.error.stack}
                      </pre>
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="text-xs mt-1 overflow-auto max-h-32">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300"
                >
                  Reload Page
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="border border-purple-500/50 hover:border-purple-400 px-6 py-3 rounded-xl font-semibold text-white hover:bg-purple-500/10 transition-colors"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}