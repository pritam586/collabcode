// Decorative backdrop: drifting aurora light, a fading dot grid and fine grain. Used behind the
// landing hero and the join screen; styles live in landing.css.
export function AuroraBackdrop() {
  return (
    <div className="landing-backdrop" aria-hidden="true">
      <div className="aurora">
        <span className="aurora-blob aurora-blob-1" />
        <span className="aurora-blob aurora-blob-2" />
        <span className="aurora-blob aurora-blob-3" />
      </div>
      <div className="texture-dots" />
      <div className="texture-grain" />
    </div>
  );
}
