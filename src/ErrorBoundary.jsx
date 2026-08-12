import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h1 className="error-boundary-title">Something Went Wrong</h1>
            <p className="error-boundary-message">
              We hit an unexpected bump. Don't worry — your books are safe. 
              Try refreshing the page or heading back to the home screen.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="error-boundary-btn"
                onClick={this.handleReload}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Refresh Page
              </button>
              <button
                className="error-boundary-btn"
                onClick={this.handleGoHome}
                style={{ background: 'linear-gradient(135deg, #1e2a3a, #2c3a4e)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Go Home
              </button>
            </div>
            {this.state.error && (
              <div style={{ marginTop: 20, textAlign: 'left', background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 200, border: '1px solid #ddd' }}>
                <strong>Error:</strong> {this.state.error.toString()}
                <br /><br />
                <strong>Stack:</strong> {this.state.error.stack || 'No stack trace'}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
