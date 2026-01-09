/**
 * GameVersionSelector - Card grid to choose VyreJack version
 *
 * Shows ETH and USDC betting options with official token logos
 */

import { useGameNavigation, type TokenType } from '@/hooks/useGameNavigation';
import { TokenApprovalModal } from './TokenApprovalModal';
import './styles/game-selector.css';

// Official token logo URLs (from Trust Wallet Assets / CoinGecko)
const TOKEN_LOGOS = {
  eth: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  usdc: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
} as const;

interface GameVersion {
  id: TokenType;
  name: string;
  token: string;
  tokenLogo: string;
  color: string;
  description: string;
  badge?: string;
}

const GAME_VERSIONS: GameVersion[] = [
  {
    id: 'eth',
    name: 'VyreJack',
    token: 'ETH',
    tokenLogo: TOKEN_LOGOS.eth,
    color: 'purple',
    description: 'Classic ETH betting',
    badge: '🔥 HOT',
  },
  {
    id: 'usdc',
    name: 'VyreJack',
    token: 'USDC',
    tokenLogo: TOKEN_LOGOS.usdc,
    color: 'blue',
    description: 'Stable dollar betting',
    badge: 'STABLE',
  },
];

export function GameVersionSelector() {
  const { navigate, isChecking, needsApproval, pendingToken, clearPending } = useGameNavigation();

  const handleApproved = () => {
    clearPending();
  };

  return (
    <>
      <section className="game-selector-section">
        <h2 className="section-title">🎮 Choose Your Game</h2>

        <div className="game-selector-grid">
          {GAME_VERSIONS.map((version) => (
            <button
              key={version.id}
              className={`game-version-card game-version-${version.color}`}
              onClick={() => navigate(version.id)}
              disabled={isChecking}
            >
              {version.badge && <span className="version-badge">{version.badge}</span>}

              <div className="version-header">
                <img
                  src={version.tokenLogo}
                  alt={version.token}
                  className="version-token-logo"
                  width={40}
                  height={40}
                />
                <div className="version-titles">
                  <h3 className="version-name">{version.name}</h3>
                  <span className="version-token">{version.token}</span>
                </div>
              </div>

              <p className="version-description">{version.description}</p>

              <div className="version-cta">
                <span className="cta-text">
                  {isChecking && pendingToken === version.id ? 'Checking...' : 'Play Now'}
                </span>
                <span className="cta-arrow">→</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Token Approval Modal */}
      {needsApproval && pendingToken && pendingToken !== 'eth' && (
        <TokenApprovalModal
          tokenType={pendingToken}
          onClose={clearPending}
          onApproved={handleApproved}
        />
      )}
    </>
  );
}
