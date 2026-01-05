/**
 * SessionModals - Onboarding and Expiry modals for Fast Mode
 */

import { useEffect } from 'preact/hooks';
import type {
  SessionExpiryModalProps,
  FastModeOnboardingProps,
  SessionWarningProps,
} from '@vyrejack/shared';
import './styles/session-modal.css';

export function SessionExpiryModal({ onExtend, onSkip, isLoading }: SessionExpiryModalProps) {
  // Handle escape key to dismiss modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onSkip();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onSkip, isLoading]);

  return (
    <div
      className="session-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expiry-title"
    >
      <div className="session-modal-content">
        <div className="session-modal-icon">⏰</div>
        <h2 id="session-expiry-title" className="session-modal-title">
          Session Expired
        </h2>
        <p className="session-modal-subtitle">
          Your Fast Mode session has ended. Extend it to continue playing without transaction
          popups.
        </p>

        <div className="session-modal-benefit">
          <span className="session-modal-benefit-icon">⚡</span>
          <span className="session-modal-benefit-text">
            Instant gameplay - no wallet confirmations needed
          </span>
        </div>

        <button className="session-modal-cta" onClick={onExtend} disabled={isLoading}>
          {isLoading ? <>⏳ Activating...</> : <>🔑 Renew Session</>}
        </button>

        <button className="session-modal-skip" onClick={onSkip}>
          Continue without Fast Mode
        </button>
      </div>
    </div>
  );
}

export function FastModeOnboarding({ onEnable, onSkip, isLoading }: FastModeOnboardingProps) {
  // Handle escape key to dismiss modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onSkip();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onSkip, isLoading]);

  return (
    <div
      className="session-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="onboarding-modal-content">
        <div className="onboarding-header">
          <div className="onboarding-icon">🚀</div>
          <h2 id="onboarding-title" className="onboarding-title">
            Enable Fast Mode
          </h2>
          <p className="onboarding-subtitle">Play without interruptions</p>
        </div>

        <div className="onboarding-features">
          <div className="onboarding-feature">
            <span className="onboarding-feature-icon">⚡</span>
            <div className="onboarding-feature-text">
              <div className="onboarding-feature-title">Instant Actions</div>
              <div className="onboarding-feature-desc">
                Hit, Stand, Double without wallet popups
              </div>
            </div>
          </div>

          <div className="onboarding-feature">
            <span className="onboarding-feature-icon">🎮</span>
            <div className="onboarding-feature-text">
              <div className="onboarding-feature-title">Seamless Gameplay</div>
              <div className="onboarding-feature-desc">Focus on the game, not confirmations</div>
            </div>
          </div>

          <div className="onboarding-feature">
            <span className="onboarding-feature-icon">✴️</span>
            <div className="onboarding-feature-text">
              <div className="onboarding-feature-title">Permanent Sessions</div>
              <div className="onboarding-feature-desc">
                Stay logged in - just enter PIN to unlock
              </div>
            </div>
          </div>
        </div>

        <div className="onboarding-security">
          <span className="onboarding-security-icon">🔒</span>
          <span className="onboarding-security-text">
            Your wallet will ask you to sign once to enable Fast Mode
          </span>
        </div>

        <button className="onboarding-cta" onClick={onEnable} disabled={isLoading}>
          {isLoading ? <>⏳ Activating...</> : <>🔑 Enable Fast Mode</>}
        </button>

        <button className="onboarding-skip" onClick={onSkip}>
          Maybe later - I'll confirm each transaction
        </button>
      </div>
    </div>
  );
}

export function SessionExpiryWarning({ minutesLeft, onExtend }: SessionWarningProps) {
  return (
    <button className="session-expiry-warning" onClick={onExtend}>
      <span>⚠️</span>
      <span>Session expires in {minutesLeft}m</span>
    </button>
  );
}
