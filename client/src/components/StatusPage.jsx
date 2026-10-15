// Full-page message for dead ends: unknown paths, invalid links, rooms that refuse a join.
export function StatusPage({ title, message, actionLabel = 'Go to the home page', onAction }) {
  return (
    <main className="fallback-page">
      <div className="fallback-card">
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="fallback-actions">
          <button type="button" className="btn btn-primary" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      </div>
    </main>
  );
}

// Placeholder with the workspace's shape while the room loads.
export function WorkspaceSkeleton({ caption = 'Joining the room…' }) {
  return (
    <div className="workspace-skeleton" role={caption ? 'status' : undefined} aria-hidden={caption ? undefined : true}>
      <div className="skeleton-header">
        <span className="skeleton" style={{ width: 140 }} />
        <span className="skeleton" style={{ width: 240 }} />
      </div>
      <div className="skeleton-body">
        <div className="skeleton-editor">
          {[72, 54, 88, 40, 64, 30, 76].map((width, index) => (
            <span key={index} className="skeleton skeleton-line" style={{ width: `${width}%` }} />
          ))}
        </div>
        <div className="skeleton-sidebar">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      </div>
      {caption && (
        <p className="skeleton-caption">
          <span className="spinner" aria-hidden="true" /> {caption}
        </p>
      )}
    </div>
  );
}
