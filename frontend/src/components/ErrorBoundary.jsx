import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-red-200 shadow-lg text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-6">
              An unexpected display error occurred while rendering the page.
            </p>
            <div className="text-left bg-red-50 p-3 rounded-lg text-xs font-mono text-red-700 overflow-x-auto mb-6">
              {this.state.error?.message || String(this.state.error)}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="btn-primary text-xs py-2 px-4"
              >
                Go to Home
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary text-xs py-2 px-4"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

