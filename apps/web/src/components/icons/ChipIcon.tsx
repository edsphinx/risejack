/**
 * ChipIcon - Casino poker chip SVG icon for CHIP token
 * Designed to look like a real casino/poker chip with edge pattern
 */

interface ChipIconProps {
  size?: number;
  className?: string;
}

export function ChipIcon({ size = 20, className = '' }: ChipIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`chip-icon ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Outer chip body */}
      <circle cx="16" cy="16" r="14" fill="url(#chipBodyGradient)" />

      {/* Edge stripes - casino chip pattern */}
      <g className="chip-edge-stripes">
        {/* Top */}
        <rect x="14" y="2" width="4" height="4" rx="1" fill="#fff" opacity="0.9" />
        {/* Top-right */}
        <rect
          x="22.5"
          y="5"
          width="4"
          height="3"
          rx="1"
          fill="#fff"
          opacity="0.9"
          transform="rotate(45 24.5 6.5)"
        />
        {/* Right */}
        <rect x="26" y="14" width="4" height="4" rx="1" fill="#fff" opacity="0.9" />
        {/* Bottom-right */}
        <rect
          x="22.5"
          y="24"
          width="4"
          height="3"
          rx="1"
          fill="#fff"
          opacity="0.9"
          transform="rotate(45 24.5 25.5)"
        />
        {/* Bottom */}
        <rect x="14" y="26" width="4" height="4" rx="1" fill="#fff" opacity="0.9" />
        {/* Bottom-left */}
        <rect
          x="5.5"
          y="24"
          width="4"
          height="3"
          rx="1"
          fill="#fff"
          opacity="0.9"
          transform="rotate(-45 7.5 25.5)"
        />
        {/* Left */}
        <rect x="2" y="14" width="4" height="4" rx="1" fill="#fff" opacity="0.9" />
        {/* Top-left */}
        <rect
          x="5.5"
          y="5"
          width="4"
          height="3"
          rx="1"
          fill="#fff"
          opacity="0.9"
          transform="rotate(-45 7.5 6.5)"
        />
      </g>

      {/* Inner decorative rings */}
      <circle cx="16" cy="16" r="10" fill="none" stroke="#fff" strokeWidth="1" opacity="0.4" />
      <circle
        cx="16"
        cy="16"
        r="7"
        fill="url(#chipCenterGradient)"
        stroke="#fff"
        strokeWidth="0.5"
        opacity="0.8"
      />

      {/* Center denomination area */}
      <circle cx="16" cy="16" r="5" fill="url(#chipDenomGradient)" />

      {/* $ or value symbol */}
      <text
        x="16"
        y="18.5"
        textAnchor="middle"
        fontSize="7"
        fontWeight="bold"
        fill="#fff"
        style={{ fontFamily: 'monospace' }}
      >
        $
      </text>

      {/* Gradients */}
      <defs>
        {/* Main chip body - purple/violet casino theme */}
        <radialGradient id="chipBodyGradient" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6d28d9" />
        </radialGradient>

        {/* Center ring */}
        <radialGradient id="chipCenterGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>

        {/* Inner denomination circle */}
        <radialGradient id="chipDenomGradient" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
      </defs>
    </svg>
  );
}
