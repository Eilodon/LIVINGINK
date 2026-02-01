import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode; // EIDOLON-V: Optional fallback instead of error screen
  onReset?: () => void; // EIDOLON-V: Soft reset callback (avoids hard F5 reload)
};

type ErrorBoundaryState = {
  error: Error | null;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('GuKing crashed:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      // EIDOLON-V: If fallback provided, use it instead of error screen
      if (this.props.fallback !== undefined) {
        console.warn('[ErrorBoundary] Error caught, using fallback:', this.state.error.message);
        return this.props.fallback;
      }
      
      return (
        <div className="w-full h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900/80 border border-slate-700 rounded-2xl p-6">
            <div className="text-2xl font-fantasy text-red-400 mb-2">Something went wrong</div>
            <div className="text-sm text-slate-300 mb-4">
              The game hit an unexpected error. Reload to continue.
            </div>
            <pre className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl p-3 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
            <div className="mt-4 flex gap-3">
              {/* EIDOLON-V: Soft reset preferred over hard reload */}
              <button
                className="px-4 py-2 rounded-lg bg-white text-black font-bold hover:bg-slate-200"
                onClick={() => {
                  this.setState({ error: null });
                  if (this.props.onReset) {
                    this.props.onReset();
                  } else {
                    window.location.reload();
                  }
                }}
              >
                {this.props.onReset ? 'Return to Menu' : 'Reload'}
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700"
                onClick={() => this.setState({ error: null })}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
