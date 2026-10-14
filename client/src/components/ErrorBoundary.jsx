import { Component } from 'react';

// Last line of defence: an unexpected render error shows a friendly page instead of a blank
// screen. Shared code is safe on the server, so reloading is always a good next step.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('CollabCode crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fallback-page">
        <div className="fallback-card">
          <h1>Something went wrong</h1>
          <p>CollabCode hit an unexpected problem. Your shared code is saved on the server, so reloading the page is safe.</p>
          <div className="fallback-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
            <a className="btn btn-secondary" href="/">Go to the home page</a>
          </div>
        </div>
      </main>
    );
  }
}
