/**
 * GameVersionSelector - Card grid to choose VyreJack version
 *
 * 🔐 TOKEN APPROVAL: Checks allowance before navigating to ERC20 versions
 * Shows TokenApprovalModal if user needs to approve CHIP/USDC
 */

import { useGameNavigation, type TokenType } from '@/hooks/useGameNavigation';
import { TokenApprovalModal } from './TokenApprovalModal';
import './styles/game-selector.css';

interface GameVersion {
  id: TokenType;
  name: string;
  token: string;
  tokenIcon: string;
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
    color: 'amber',
    description: 'Bet with CHIP tokens',
    badge: '🔥 HOT',
  },
  {
    id: 'usdc',
    name: 'VyreJack',
    token: 'USDC',
    tokenIcon: '💵',
    color: 'blue',
    description: 'Bet with USDC stablecoin',
    badge: 'NEW',
  },
  {
    id: 'eth',
    name: 'VyreJack',
    token: 'ETH',
    tokenIcon: '⟠',
    color: 'emerald',
    description: 'Classic ETH betting',
    badge: 'OG',
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
                <span className="version-token-icon">{version.tokenIcon}</span>
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
