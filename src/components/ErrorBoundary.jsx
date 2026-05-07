import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark flex flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="text-paper/20 text-5xl">◐</span>
          <p className="text-paper/60 italic text-xl" style={{ fontFamily: "'Fraunces', serif" }}>Something went wrong.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-mono text-rust border border-rust/30 px-6 py-2 hover:bg-rust hover:text-dark transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
