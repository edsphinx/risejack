# Card Rendering Engine

> **Status**: 📋 Planned  
> **Target**: Q1 2026  
> **Package**: `@risejack/card-engine`

## Overview

A TypeScript-based rendering engine for consistent card display across all platforms (desktop, tablet, mobile, smartwatch) and all card games in the RISECASINO ecosystem.

---

## Problem Statement

Current implementation uses CSS-only with static breakpoints:

```css
/* Current approach - scattered across CSS files */
@media (max-width: 640px) {
  .hand-card {
    margin-left: calc(var(--card-index, 0) * -98px);
  }
}
```

**Issues:**

1. No centralized configuration
2. Difficult to maintain across multiple games
3. Animation timings aren't device-aware
4. Tablet/watch support requires duplicating logic
5. No runtime device detection

---

## Architecture

### Package Structure

```
packages/card-engine/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Public exports
│   ├── types.ts                    # TypeScript definitions
│   ├── device-detection.ts         # Viewport → DeviceType
│   ├── get-config.ts               # Config resolution
│   ├── configs/
│   │   ├── index.ts
│   │   ├── desktop.config.ts
│   │   ├── tablet.config.ts
│   │   ├── mobile.config.ts
│   │   └── watch.config.ts
│   ├── presets/
│   │   ├── index.ts
│   │   ├── blackjack.preset.ts
│   │   ├── poker.preset.ts
│   │   └── baccarat.preset.ts
│   └── hooks/
│       └── useCardEngine.ts        # React/Preact hook
└── tests/
    ├── device-detection.test.ts
    └── get-config.test.ts
```

---

## Type Definitions

```typescript
// types.ts

export type DeviceType =
  | 'desktop'
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'mobile'
  | 'mobile-small'
  | 'watch';

export type RenderMode =
  | 'spread' // Full visibility, slight overlap
  | 'stack' // Poker-style, corner only
  | 'minimal'; // Value-only, no card visuals

export type GameType = 'blackjack' | 'poker' | 'baccarat' | 'generic';

export interface CardDimensions {
  width: number; // px
  height: number; // px
  borderRadius: number;
}

export interface StackingConfig {
  overlap: number; // Negative margin (px)
  visibleWidth: number; // What's visible per card (px)
  hoverExpand: number; // Overlap on hover (px)
}

export interface AnimationConfig {
  dealDuration: number; // ms
  flipDuration: number; // ms
  staggerDelay: number; // ms between consecutive cards
  easing: string; // CSS easing function
  hoverEnabled: boolean;
}

export interface DeviceConfig {
  device: DeviceType;
  breakpoint: {
    min: number;
    max: number;
  };
  renderMode: RenderMode;
  card: CardDimensions;
  stacking: StackingConfig;
  animation: AnimationConfig;
}

export interface CardEngineConfig {
  device: DeviceConfig;
  game: GameType;
}
```

---

## Device Detection

```typescript
// device-detection.ts

import type { DeviceType } from './types';

export function detectDevice(viewportWidth: number): DeviceType {
  if (viewportWidth < 220) return 'watch';
  if (viewportWidth < 400) return 'mobile-small';
  if (viewportWidth < 640) return 'mobile';
  if (viewportWidth < 768) return 'tablet-portrait';
  if (viewportWidth < 1024) return 'tablet-landscape';
  return 'desktop';
}

export function getBreakpoint(device: DeviceType): { min: number; max: number } {
  const breakpoints: Record<DeviceType, { min: number; max: number }> = {
    desktop: { min: 1024, max: Infinity },
    'tablet-landscape': { min: 768, max: 1023 },
    'tablet-portrait': { min: 640, max: 767 },
    mobile: { min: 400, max: 639 },
    'mobile-small': { min: 220, max: 399 },
    watch: { min: 0, max: 219 },
  };
  return breakpoints[device];
}
```

---

## Default Configurations

### Desktop (≥1024px)

```typescript
// configs/desktop.config.ts

export const desktopConfig: DeviceConfig = {
  device: 'desktop',
  breakpoint: { min: 1024, max: Infinity },
  renderMode: 'spread',
  card: {
    width: 90,
    height: 126,
    borderRadius: 6,
  },
  stacking: {
    overlap: -20,
    visibleWidth: 70,
    hoverExpand: -10,
  },
  animation: {
    dealDuration: 500,
    flipDuration: 500,
    staggerDelay: 200,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    hoverEnabled: true,
  },
};
```

### Mobile (400-639px)

```typescript
// configs/mobile.config.ts

export const mobileConfig: DeviceConfig = {
  device: 'mobile',
  breakpoint: { min: 400, max: 639 },
  renderMode: 'stack',
  card: {
    width: 126,
    height: 176,
    borderRadius: 8,
  },
  stacking: {
    overlap: -98, // Only ~28px visible (corner)
    visibleWidth: 28,
    hoverExpand: -80, // Expand slightly on touch
  },
  animation: {
    dealDuration: 350,
    flipDuration: 350,
    staggerDelay: 120,
    easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
    hoverEnabled: false,
  },
};
```

### Watch (<220px) - Future

```typescript
// configs/watch.config.ts

export const watchConfig: DeviceConfig = {
  device: 'watch',
  breakpoint: { min: 0, max: 219 },
  renderMode: 'minimal',
  card: {
    width: 28,
    height: 40,
    borderRadius: 2,
  },
  stacking: {
    overlap: -22, // Only rank visible
    visibleWidth: 6,
    hoverExpand: -22,
  },
  animation: {
    dealDuration: 150,
    flipDuration: 150,
    staggerDelay: 50,
    easing: 'ease-out',
    hoverEnabled: false,
  },
};
```

---

## Configuration Matrix

| Device   | Viewport   | Mode    | Card Size | Overlap | Visible | Deal Speed |
| -------- | ---------- | ------- | --------- | ------- | ------- | ---------- |
| Desktop  | ≥1024px    | Spread  | 90×126    | -20px   | 70px    | 500ms      |
| Tablet L | 768-1023px | Spread  | 80×112    | -25px   | 55px    | 450ms      |
| Tablet P | 640-767px  | Stack   | 100×140   | -72px   | 28px    | 400ms      |
| Mobile   | 400-639px  | Stack   | 126×176   | -98px   | 28px    | 350ms      |
| Mobile S | 220-399px  | Stack   | 107×150   | -82px   | 25px    | 300ms      |
| Watch    | <220px     | Minimal | 28×40     | -22px   | 6px     | 150ms      |

---

## React/Preact Hook

```typescript
// hooks/useCardEngine.ts

import { useEffect, useState, useMemo } from 'preact/hooks';
import { detectDevice } from '../device-detection';
import { getDeviceConfig } from '../get-config';
import type { CardEngineConfig, GameType } from '../types';

interface UseCardEngineOptions {
  game?: GameType;
  debounceMs?: number;
}

export function useCardEngine(options: UseCardEngineOptions = {}): CardEngineConfig {
  const { game = 'generic', debounceMs = 100 } = options;

  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setViewportWidth(window.innerWidth);
      }, debounceMs);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [debounceMs]);

  const config = useMemo(() => {
    const device = detectDevice(viewportWidth);
    const deviceConfig = getDeviceConfig(device, game);
    return { device: deviceConfig, game };
  }, [viewportWidth, game]);

  return config;
}
```

---

## Usage Example

### Before (CSS-only)

```tsx
// Hand.tsx - Current implementation
import './styles/hand.css';

export function Hand({ cards }) {
  return (
    <div className="hand-cards">
      {cards.map((card, i) => (
        <div className="hand-card" style={`--card-index: ${i}`}>
          <PlayingCard cardIndex={card} />
        </div>
      ))}
    </div>
  );
}
```

### After (Card Engine)

```tsx
// Hand.tsx - With Card Engine
import { useCardEngine } from '@risejack/card-engine';

export function Hand({ cards }) {
  const { device } = useCardEngine({ game: 'blackjack' });
  const { stacking, animation, renderMode } = device;

  return (
    <div className={`hand-cards hand-cards--${renderMode}`}>
      {cards.map((card, i) => (
        <div
          key={card}
          className="hand-card"
          style={{
            marginLeft: i === 0 ? 0 : stacking.overlap,
            zIndex: i,
            transitionDuration: `${animation.dealDuration}ms`,
          }}
        >
          <PlayingCard cardIndex={card} width={device.card.width} height={device.card.height} />
        </div>
      ))}
    </div>
  );
}
```

---

## Game-Specific Presets

Each game can override default device configs:

```typescript
// presets/poker.preset.ts

import type { DeviceConfig } from '../types';

export function applyPokerPreset(config: DeviceConfig): DeviceConfig {
  return {
    ...config,
    stacking: {
      ...config.stacking,
      // Poker always uses tight stacking (2-card hands)
      overlap: Math.min(config.stacking.overlap, -80),
      visibleWidth: Math.min(config.stacking.visibleWidth, 20),
    },
    animation: {
      ...config.animation,
      // Faster dealing for poker
      dealDuration: config.animation.dealDuration * 0.8,
      staggerDelay: config.animation.staggerDelay * 0.5,
    },
  };
}
```

---

## CSS Variables Export

The engine can also export CSS custom properties for hybrid approaches:

```typescript
// css-vars.ts

export function toCSSVariables(config: DeviceConfig): string {
  return `
    --card-width: ${config.card.width}px;
    --card-height: ${config.card.height}px;
    --card-radius: ${config.card.borderRadius}px;
    --card-overlap: ${config.stacking.overlap}px;
    --card-visible: ${config.stacking.visibleWidth}px;
    --deal-duration: ${config.animation.dealDuration}ms;
    --flip-duration: ${config.animation.flipDuration}ms;
    --stagger-delay: ${config.animation.staggerDelay}ms;
    --animation-easing: ${config.animation.easing};
  `;
}
```

Usage in component:

```tsx
function Hand({ cards }) {
  const { device } = useCardEngine();

  return (
    <div className="hand-cards" style={toCSSVariables(device)}>
      {/* CSS uses var(--card-overlap) etc. */}
    </div>
  );
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/device-detection.test.ts

import { detectDevice } from '../src/device-detection';

describe('detectDevice', () => {
  it('returns desktop for wide viewports', () => {
    expect(detectDevice(1920)).toBe('desktop');
    expect(detectDevice(1024)).toBe('desktop');
  });

  it('returns mobile for narrow viewports', () => {
    expect(detectDevice(375)).toBe('mobile-small');
    expect(detectDevice(414)).toBe('mobile');
  });

  it('returns watch for tiny viewports', () => {
    expect(detectDevice(184)).toBe('watch');
  });
});
```

### Visual Regression Tests

Use Playwright to capture screenshots at each breakpoint and compare with baseline images.

---

## Migration Plan

1. **Create package** - Set up `packages/card-engine` in monorepo
2. **Implement core** - Types, detection, configs
3. **Add hook** - React/Preact integration
4. **Migrate RiseJack** - Update `Hand.tsx` to use engine
5. **Keep CSS fallback** - For initial load before JS hydrates
6. **Remove legacy CSS** - Once migration is verified
7. **Document** - API reference and examples

## Related Documents

- [FRONTEND.md](./FRONTEND.md) - Current frontend architecture
- [SMART_CONTRACTS.md](./SMART_CONTRACTS.md) - Contract architecture
- [BACKEND_EVALUATION.md](./BACKEND_EVALUATION.md) - Backend stack decisions
