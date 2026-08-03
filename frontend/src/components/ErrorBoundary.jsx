import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container section empty-state">
          <div className="error-icon">!</div>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred while rendering this page. Please try again.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="btn btn-outline" href="/">
              Back to home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
