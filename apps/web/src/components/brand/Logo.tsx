import './styles/brand.css';

/**
 * RiseJack Logo Component
 *
 * DEGEN UX branded logo with CSS animations
 * Variants: full (desktop), compact (mobile), icon (minimal)
 */

interface LogoProps {
  size?: 'full' | 'compact' | 'icon';
  animated?: boolean;
  className?: string;
}

export function Logo({ size = 'full', animated = true, className = '' }: LogoProps) {
  const animatedClass = animated ? 'logo-animated' : '';

  if (size === 'icon') {
    return (
      <div className={`logo-icon ${animatedClass} ${className}`}>
        <SpadeIcon />
      </div>
    );
  }

  if (size === 'compact') {
    return (
      <div className={`logo-compact ${animatedClass} ${className}`}>
        <SpadeIcon />
        <span className="logo-text-short">RJ</span>
      </div>
    );
  }

  // Full logo (desktop)
  return (
    <div className={`logo-full ${animatedClass} ${className}`}>
      <SpadeIcon />
      <span className="logo-text">RISEJACK</span>
    </div>
  );
}

/**
 * Spade Icon - SVG with DEGEN gradient
 */
function SpadeIcon() {
  return (
    <svg
      className="logo-spade"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="RiseJack Spade"
    >
      <defs>
        <linearGradient id="spadeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="spadeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Spade shape */}
      <path
        d="M50 10 C30 35, 10 50, 10 65 C10 85, 30 90, 50 75 C70 90, 90 85, 90 65 C90 50, 70 35, 50 10 Z M50 75 L50 95 M35 95 L65 95"
        fill="url(#spadeGradient)"
        stroke="url(#spadeGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#spadeGlow)"
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
