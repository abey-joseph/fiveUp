import { Component, type ErrorInfo, type ReactNode } from 'react'
import CenteredCard from './CenteredCard.tsx'

interface State {
  error: Error | null
}

/** Last-resort screen for unexpected render errors, with a reload button. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FiveUp crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <CenteredCard>
        <h1 className="text-xl font-bold text-stone-900">Something went wrong</h1>
        <p className="mt-3 text-sm text-stone-600">
          Your logged meals are safe. Reloading the app usually fixes this.
        </p>
        <p className="mt-2 font-mono text-xs break-words text-stone-500">
          {this.state.error.message}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 min-h-12 w-full rounded-full bg-brand-700 px-5 font-semibold text-white transition hover:bg-brand-800"
        >
          Reload
        </button>
      </CenteredCard>
    )
  }
}
