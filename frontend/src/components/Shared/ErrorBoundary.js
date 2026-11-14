import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep runtime failures visible during QA without exposing internal details to users.
    // eslint-disable-next-line no-console
    console.error('PowerShare UI error boundary:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="ui-error-boundary" role="alert" aria-live="assertive">
        <div className="table-card ui-error-card">
          <h4 className="mb-2">Something went wrong</h4>
          <p className="text-muted mb-3">
            The page could not be displayed. Your saved data has not been changed by this screen error.
          </p>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-primary" onClick={this.handleRetry}>Try again</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => window.location.reload()}>Reload page</button>
          </div>
        </div>
      </div>
    );
  }
}
