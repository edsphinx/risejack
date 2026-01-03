/**
 * useTabFocus - Detect if tab is active (visible)
 * Used to prevent actions from background tabs
 * SSR-safe: guards against document access during server-side rendering
 */

import { useState, useEffect } from 'preact/hooks';

export function useTabFocus(): boolean {
  // SSR-safe initialization: check if document exists before accessing
  const [isActiveTab, setIsActiveTab] = useState(() =>
    typeof document !== 'undefined' ? !document.hidden : true
  );

  useEffect(() => {
    // Guard against SSR - document may not exist
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsActiveTab(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isActiveTab;
}
