/**
 * AppLoader - Animated splash screen that preloads heavy dependencies
 * Shows a premium casino-themed animation while Rise Wallet + Viem load in background
 */

import { useState, useEffect } from 'preact/hooks';
import { Logo } from '@/components/brand/Logo';
import './app-loader.css';

interface AppLoaderProps {
    onLoadComplete: () => void;
    minimumDisplayTime?: number; // Minimum time to show animation (ms)
}

export function AppLoader({ onLoadComplete, minimumDisplayTime = 2000 }: AppLoaderProps) {
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [statusText, setStatusText] = useState('Initializing...');

    useEffect(() => {
        const startTime = Date.now();
        let loaded = false;

        // Simulate loading stages with preloading
        const loadStages = async () => {
            // Stage 1: Initial animation
            setStatusText('Loading casino...');
            setLoadingProgress(20);
            await delay(300);

            // Stage 2: Preload Rise Wallet (heavy)
            setStatusText('Connecting to Rise Chain...');
            setLoadingProgress(40);
            try {
                await import('rise-wallet');
            } catch {
                // Silent fail - will load on demand
            }
            setLoadingProgress(60);

            // Stage 3: Preload Viem (heavy)
            setStatusText('Loading Web3...');
            try {
                await import('viem');
            } catch {
                // Silent fail - will load on demand
            }
            setLoadingProgress(80);

            // Stage 4: Final prep
            setStatusText('Ready to play!');
            setLoadingProgress(100);

            loaded = true;

            // Ensure minimum display time for smooth animation
            const elapsed = Date.now() - startTime;
            if (elapsed < minimumDisplayTime) {
                await delay(minimumDisplayTime - elapsed);
            }

            // Fade out and complete
            await delay(300);
            onLoadComplete();
        };

        loadStages();

        // Fallback timeout in case something hangs
        const timeout = setTimeout(() => {
            if (!loaded) {
                onLoadComplete();
            }
        }, 5000);

        return () => clearTimeout(timeout);
    }, [onLoadComplete, minimumDisplayTime]);

    return (
        <div className="app-loader">
            <div className="app-loader-content">
                {/* Animated Logo - Using existing brand */}
                <div className="app-loader-logo">
                    <Logo className="loader-brand-logo" />
                </div>

                {/* Progress bar */}
                <div className="app-loader-progress">
                    <div
                        className="app-loader-progress-fill"
                        style={{ width: `${loadingProgress}%` }}
                    />
                </div>

                {/* Status text */}
                <p className="app-loader-status">{statusText}</p>
            </div>

            {/* Background effects */}
            <div className="app-loader-bg">
                <div className="loader-particle p1" />
                <div className="loader-particle p2" />
                <div className="loader-particle p3" />
            </div>
        </div>
    );
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
