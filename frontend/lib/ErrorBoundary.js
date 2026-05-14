import React from "react";

/**
 * ErrorBoundary catches unhandled errors in child components
 * and displays a recovery UI instead of crashing the entire page.
 * 
 * Usage: Wrap page content in _app.js or individual pages.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--ink, #ccc)',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>⚠️</div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            marginBottom: '8px',
            color: 'var(--ink, #fff)'
          }}>
            Algo deu errado
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--ink-soft, #999)',
            maxWidth: '400px',
            lineHeight: 1.6,
            marginBottom: '24px'
          }}>
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              background: 'var(--accent, #00ff88)',
              color: '#000',
              border: 'none',
              padding: '12px 32px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
          >
            Recarregar Página
          </button>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre style={{
              marginTop: '24px',
              padding: '16px',
              background: 'rgba(255,0,0,0.1)',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#ef4444',
              maxWidth: '600px',
              overflow: 'auto',
              textAlign: 'left'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
