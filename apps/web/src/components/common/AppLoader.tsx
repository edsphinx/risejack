/**
 * AppLoader - Minimalist casino splash screen
 * Clean design: Logo + shimmer progress bar only
 */

import { useState, useEffect } from 'preact/hooks';
import { Logo } from '@/components/brand/Logo';
import './app-loader.css';

interface AppLoaderProps {
  onLoadComplete: () => void;
  minimumDisplayTime?: number;
}

export function AppLoader({ onLoadComplete, minimumDisplayTime = 2000 }: AppLoaderProps) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');

  useEffect(() => {
    const startTime = Date.now();
    let loaded = false;

    const loadStages = async () => {
      setStatusText('Loading casino...');
      setLoadingProgress(20);
      await delay(300);

      setStatusText('Connecting to Rise Chain...');
      setLoadingProgress(40);
      try {
        await import('rise-wallet');
      } catch {
        // Silent fail
      }
      setLoadingProgress(60);

      setStatusText('Loading Web3...');
      try {
        await import('viem');
      } catch {
        // Silent fail
      }
      setLoadingProgress(80);

      setStatusText('Ready to play!');
      setLoadingProgress(100);
      loaded = true;

      const elapsed = Date.now() - startTime;
      if (elapsed < minimumDisplayTime) {
        await delay(minimumDisplayTime - elapsed);
      }

      await delay(300);
      onLoadComplete();
    };

    loadStages();

    const timeout = setTimeout(() => {
      if (!loaded) onLoadComplete();
    }, 5000);

    return () => clearTimeout(timeout);
  }, [onLoadComplete, minimumDisplayTime]);

  return (
    <div className="app-loader">
      {/* Background glow */}
      <div className="app-loader-glow" />

      <div className="app-loader-content">
        {/* VyreCasino Logo - centered and properly sized */}
        <div className="app-loader-logo">
          <Logo variant="vyrecasino" size="full" animated={false} />
        </div>

        {/* Clean shimmer progress bar */}
        <div className="app-loader-progress">
          <div className="app-loader-progress-fill" style={{ width: `${loadingProgress}%` }} />
        </div>

        {/* Status text */}
        <p className="app-loader-status">{statusText}</p>
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
