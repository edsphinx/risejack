/**
 * PageLoader - Loading fallback for lazy-loaded pages
 * Uses same casino theme as AppLoader for unified experience
 */

import './page-loader.css';

export function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-glow" />
      <div className="page-loader-content">
        {/* Bouncing Chips */}
        <div className="page-loader-chips">
          <span className="pl-chip" />
          <span className="pl-chip" />
          <span className="pl-chip" />
        </div>

        {/* Shimmer Bar */}
        <div className="page-loader-shimmer">
          <div className="pl-shimmer-bar" />
        </div>

        <p className="page-loader-text">Loading...</p>
      </div>
    </div>
  );
}
