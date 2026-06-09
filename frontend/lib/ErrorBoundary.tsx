import React, { ReactNode, ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary catches unhandled errors in child components
 * and displays a recovery UI instead of crashing the entire page.
 *
 * Usage: Wrap page content in _app.tsx or individual pages.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryUI 
          error={this.state.error}
          reset={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorBoundaryUI({ reset, error }: { reset: () => void, error: Error | null }) {
  const { useI18n } = require('./i18n');
  const { t } = useI18n();

  return (
    <div className="card danger-card" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      margin: '40px auto',
      maxWidth: '600px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '48px',
        marginBottom: '16px'
      }}>⚠️</div>
      <h2 className="text-danger font-bold" style={{
        fontSize: '20px',
        marginBottom: '8px',
      }}>
        {t('error_title')}
      </h2>
      <p style={{
        fontSize: '14px',
        color: 'var(--ink-soft)',
        maxWidth: '400px',
        lineHeight: 1.6,
        marginBottom: '24px'
      }}>
        {t('error_desc')}
      </p>
      <button
        onClick={reset}
        className="btn-primary"
      >
        {t('error_reload')}
      </button>
      {process.env.NODE_ENV !== 'production' && error && (
        <pre style={{
          marginTop: '24px',
          padding: '16px',
          background: 'var(--status-error-bg)',
          borderRadius: '8px',
          fontSize: '11px',
          color: 'var(--status-error)',
          maxWidth: '100%',
          overflow: 'auto',
          textAlign: 'left'
        }}>
          {error.toString()}
        </pre>
      )}
    </div>
  );
}

export default ErrorBoundary;
