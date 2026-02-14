import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        // TODO: Send to Sentry
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{
                    padding: '20px',
                    color: '#ff4d4f',
                    background: '#1f1f1f',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace'
                }}>
                    <h1>Something went wrong.</h1>
                    <p>{this.state.error?.message}</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            background: '#ff4d4f',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            borderRadius: '4px'
                        }}
                    >
                        Reload Game
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
