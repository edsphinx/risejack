/**
 * PageLoader - Loading fallback component for lazy-loaded pages
 */

import './page-loader.css';

export function PageLoader() {
    return (
        <div className="page-loader">
            <div className="page-loader-spinner" />
            <p className="page-loader-text">Loading...</p>
        </div>
    );
}
