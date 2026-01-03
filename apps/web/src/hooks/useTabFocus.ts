/**
 * useTabFocus - Detect if tab is active (visible)
 * Used to prevent actions from background tabs
 */

import { useState, useEffect } from 'preact/hooks';

export function useTabFocus(): boolean {
  const [isActiveTab, setIsActiveTab] = useState(!document.hidden);

  useEffect(() => {
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
