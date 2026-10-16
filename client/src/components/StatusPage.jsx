import { useId } from 'react';
import { House } from 'lucide-react';
import { AuroraBackdrop } from './AuroraBackdrop.jsx';
import { Logo } from './Logo.jsx';
import { Button } from './ui/Button.jsx';
import { Spinner } from './ui/Spinner.jsx';

// Full-page message for dead ends: unknown paths, invalid links, rooms that refuse a join and
// crashes. `code` (like "404") is shown large above the card; `icon` is a Lucide component;
// `children` holds extra actions after the main one.
export function StatusPage({
  code,
  icon: Icon,
  tone = 'neutral',
  title,
  message,
  actionLabel = 'Go to the home page',
  onAction,
  children,
}) {
  const titleId = useId();
  return (
    <div className="status-screen">
      <AuroraBackdrop />
      <header className="page-nav">
        <a className="page-home" href="/" aria-label="CollabCode home">
          <Logo />
        </a>
      </header>
      <main className="page-main">
        <section className={`status-card glass status-${tone}`} aria-labelledby={titleId}>
          {code && (
            <p className="status-code" aria-hidden="true">
              {code}
            </p>
          )}
          {Icon && (
            <span className="status-icon" aria-hidden="true">
              <Icon size={22} />
            </span>
          )}
          <h1 id={titleId}>{title}</h1>
          <p className="status-message">{message}</p>
          <div className="status-actions">
            <Button variant="primary" icon={<House size={16} aria-hidden="true" />} onClick={onAction}>
              {actionLabel}
            </Button>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

// Placeholder with the workspace's shape while the room loads: the top bar, the file tab, a
// few lines of "code" with line numbers, the sidebar and the status bar, all shimmering.
export function WorkspaceSkeleton({ caption = 'Joining the room…' }) {
  return (
    <div className="workspace-skeleton">
      <div className="skeleton-header" aria-hidden="true">
        <span className="skeleton skeleton-logo" />
        <span className="skeleton skeleton-chip" />
        <span className="skeleton-header-center">
          <span className="skeleton skeleton-select" />
          <span className="skeleton skeleton-run" />
        </span>
        <span className="skeleton-header-end">
          <span className="skeleton skeleton-button" />
          <span className="skeleton skeleton-avatars" />
        </span>
      </div>
      <div className="skeleton-body">
        <div className="skeleton-editor">
          <span className="skeleton-file-tab" aria-hidden="true">
            <span className="skeleton skeleton-tab" />
          </span>
          <div className="skeleton-code" aria-hidden="true">
            {[58, 34, 72, 46, 0, 64, 28, 52].map((width, index) => (
              <span key={index} className="skeleton-code-line">
                <span className="skeleton-gutter">{index + 1}</span>
                {width > 0 && <span className="skeleton skeleton-line" style={{ width: `${width}%` }} />}
              </span>
            ))}
          </div>
          {caption && (
            <p className="skeleton-caption" role="status">
              <Spinner size="lg" />
              {caption}
            </p>
          )}
        </div>
        <div className="skeleton-sidebar" aria-hidden="true">
          <span className="skeleton-tabs">
            <span className="skeleton skeleton-tab" />
            <span className="skeleton skeleton-tab" />
            <span className="skeleton skeleton-tab" />
          </span>
          {[0, 1].map((index) => (
            <span key={index} className="skeleton-person">
              <span className="skeleton skeleton-circle skeleton-avatar" />
              <span className="skeleton-person-text">
                <span className="skeleton skeleton-text" style={{ width: '60%' }} />
                <span className="skeleton skeleton-text" style={{ width: '36%' }} />
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="skeleton-status" aria-hidden="true" />
    </div>
  );
}
