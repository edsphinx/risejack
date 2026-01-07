/**
 * AppLoader - Simple pulsing logo animation
 * No progress bar alignment issues - just centered logo with glow pulse
 */

import { useState, useEffect } from 'preact/hooks';
import { Logo } from '@/components/brand/Logo';
import './app-loader.css';

interface AppLoaderProps {
  onLoadComplete: () => void;
  minimumDisplayTime?: number;
}

export function AppLoader({ onLoadComplete, minimumDisplayTime = 2000 }: AppLoaderProps) {
  const [statusText, setStatusText] = useState('Loading...');

  useEffect(() => {
    const startTime = Date.now();
    let loaded = false;

    const loadStages = async () => {
      setStatusText('Loading casino...');
      await delay(400);

      setStatusText('Connecting...');
      try {
        await import('rise-wallet');
      } catch {
        // Silent fail
      }

      setStatusText('Almost ready...');
      try {
        await import('viem');
      } catch {
        // Silent fail
      }

      setStatusText('Ready!');
      loaded = true;

      const elapsed = Date.now() - startTime;
      if (elapsed < minimumDisplayTime) {
        await delay(minimumDisplayTime - elapsed);
      }

      await delay(200);
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
      {/* Animated background rings */}
      <div className="loader-ring ring-1" />
      <div className="loader-ring ring-2" />
      <div className="loader-ring ring-3" />

      <div className="app-loader-content">
        {/* Logo with pulse animation */}
        <div className="loader-logo-wrapper">
          <Logo variant="vyrecasino" size="full" animated={false} />
        </div>

        {/* Simple dots animation */}
        <div className="loader-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>

        <p className="loader-status">{statusText}</p>
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
