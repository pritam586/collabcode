import { Component } from 'react';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { StatusPage } from './StatusPage.jsx';
import { Button } from './ui/Button.jsx';
import { CopyButton } from './ui/CopyButton.jsx';

// Last line of defence: an unexpected render error shows a friendly page instead of a blank
// screen. Shared code is safe on the server, so reloading is always a good next step. The
// details can be copied for a bug report.
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
    const { error } = this.state;
    if (!error) return this.props.children;
    const details = `${error.name}: ${error.message}\n${window.location.href}\n${navigator.userAgent}`;
    return (
      <StatusPage
        icon={TriangleAlert}
        tone="danger"
        title="Something went wrong"
        message="CollabCode hit an unexpected problem. Your shared code is saved on the server, so reloading the page is safe."
        onAction={() => window.location.assign('/')}
      >
        <Button
          variant="secondary"
          icon={<RotateCw size={16} aria-hidden="true" />}
          onClick={() => window.location.reload()}
        >
          Reload page
        </Button>
        <CopyButton text={details} label="Copy error details" variant="ghost" />
      </StatusPage>
    );
  }
}
