/**
 * GameVersionSelector - Card grid to choose VyreJack version
 *
 * 🧱 PURE COMPONENT: Receives all state via props
 * Displays available game versions with CTAs
 */

import { useLocation } from 'wouter-preact';
import './styles/game-selector.css';

interface GameVersion {
  id: string;
  name: string;
  token: string;
  tokenIcon: string;
  route: string;
  color: string;
  description: string;
  badge?: string;
}

const GAME_VERSIONS: GameVersion[] = [
  {
    id: 'chip',
    name: 'VyreJack',
    token: 'CHIP',
    tokenIcon: '🟡',
    route: '/games/vyrejack-chip',
    color: 'amber',
    description: 'Bet with CHIP tokens',
    badge: '🔥 HOT',
  },
  {
    id: 'usdc',
    name: 'VyreJack',
    token: 'USDC',
    tokenIcon: '💵',
    route: '/games/vyrejack-usdc',
    color: 'blue',
    description: 'Bet with USDC stablecoin',
    badge: 'NEW',
  },
  {
    id: 'eth',
    name: 'VyreJack',
    token: 'ETH',
    tokenIcon: '⟠',
    route: '/games/vyrejack-eth',
    color: 'emerald',
    description: 'Classic ETH betting',
    badge: 'OG',
  },
];

export function GameVersionSelector() {
  const [, setLocation] = useLocation();

  return (
    <section className="game-selector-section">
      <h2 className="section-title">🎮 Choose Your Game</h2>

      <div className="game-selector-grid">
        {GAME_VERSIONS.map((version) => (
          <button
            key={version.id}
            className={`game-version-card game-version-${version.color}`}
            onClick={() => setLocation(version.route)}
          >
            {version.badge && <span className="version-badge">{version.badge}</span>}

            <div className="version-header">
              <span className="version-token-icon">{version.tokenIcon}</span>
              <div className="version-titles">
                <h3 className="version-name">{version.name}</h3>
                <span className="version-token">{version.token}</span>
              </div>
            </div>

            <p className="version-description">{version.description}</p>

            <div className="version-cta">
              <span className="cta-text">Play Now</span>
              <span className="cta-arrow">→</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
