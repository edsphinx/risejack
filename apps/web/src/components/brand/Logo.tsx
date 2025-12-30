import './styles/brand.css';

/**
 * RiseJack Logo Component
 *
 * DEGEN UX branded logo with CSS animations
 * Variants: full (desktop), compact (mobile), icon (minimal)
 */

interface LogoProps {
  size?: 'full' | 'compact' | 'icon';
  variant?: 'risejack' | 'risecasino';
  animated?: boolean;
  className?: string;
}

export function Logo({
  size = 'full',
  variant = 'risejack',
  animated = true,
  className = '',
}: LogoProps) {
  const animatedClass = animated ? 'logo-animated' : '';
  const text = variant === 'risecasino' ? 'RISECASINO' : 'RISEJACK';

  if (size === 'icon') {
    return (
      <div className={`logo-icon ${animatedClass} ${className}`}>
        <SpadeIcon />
      </div>
    );
  }

  if (size === 'compact') {
    // Full name even on mobile for brand recognition
    return (
      <div className={`logo-compact ${animatedClass} ${className}`}>
        <SpadeIcon />
        <div className="logo-text-wrapper">
          <span className="logo-text">{text}</span>
        </div>
      </div>
    );
  }

  // Full logo (desktop)
  return (
    <div className={`logo-full ${animatedClass} ${className}`}>
      <SpadeIcon />
      <div className="logo-text-wrapper">
        <span className="logo-text">{text}</span>
      </div>
    </div>
  );
}

/**
 * Spade Icon - SVG with DEGEN gradient
 * Uses unique IDs to prevent collision when multiple instances exist
 */
function SpadeIcon() {
  // Generate unique ID to prevent SVG gradient collision
  const uniqueId = Math.random().toString(36).substring(2, 8);
  const gradientId = `spadeGrad-${uniqueId}`;
  const glowId = `spadeGlow-${uniqueId}`;

  return (
    <svg
      className="logo-spade"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="RiseJack Spade"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Spade body */}
      <path
        d="M50 5 C50 5 15 40 15 55 C15 70 30 75 42 68 C40 78 35 85 30 90 L70 90 C65 85 60 78 58 68 C70 75 85 70 85 55 C85 40 50 5 50 5 Z"
        fill={`url(#${gradientId})`}
        filter={`url(#${glowId})`}
      />
    </svg>
  );
}

/**
 * RiseJack Loader Component
 *
 * CSS-only loading animation (no Framer Motion)
 * Inspired by VeriFi loader pattern
 */
export function RiseJackLoader({ message = 'DEALING...' }: { message?: string }) {
  return (
    <div className="risejack-loader">
      {/* Outer rotating ring */}
      <div className="loader-ring">
        <div className="loader-dot" />
      </div>

      {/* Glow background */}
      <div className="loader-glow" />

      {/* Center logo with pulse */}
      <div className="loader-center">
        <SpadeIcon />
      </div>

      {/* Particles */}
      <div className="loader-particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`loader-particle particle-${i}`} />
        ))}
      </div>

      {/* Loading text */}
      <div className="loader-text">
        <span>{message}</span>
        <div className="loader-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      </div>
    </div>
  );
}
