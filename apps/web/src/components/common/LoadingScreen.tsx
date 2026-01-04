/**
 * LoadingScreen - Branded loading screen for Rise Casino
 * Shows animated logo and loading state
 */

import { Logo } from '@/components/brand/Logo';
import './LoadingScreen.css';

interface LoadingScreenProps {
    message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
    return (
        <div className="loading-screen">
            <div className="loading-bg-glow" />
            <div className="loading-content">
                <div className="loading-logo">
                    <Logo className="animated-logo" />
                </div>
                <div className="loading-spinner">
                    <div className="spinner-ring" />
                    <div className="spinner-ring" />
                    <div className="spinner-ring" />
                </div>
                <p className="loading-message">{message}</p>
                <div className="loading-cards">
                    <span className="floating-card">♠</span>
                    <span className="floating-card">♥</span>
                    <span className="floating-card">♦</span>
                    <span className="floating-card">♣</span>
                </div>
            </div>
        </div>
    );
}
