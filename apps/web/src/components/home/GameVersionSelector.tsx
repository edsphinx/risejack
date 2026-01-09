/**
 * GameVersionSelector - Single card to play VyreJack with USDC
 *
 * Simplified: just navigate to game, Rise Wallet handles approval
 */

import { useGameNavigation } from '@/hooks/useGameNavigation';
import './styles/game-selector.css';

// Official USDC logo
const USDC_LOGO = 'https://assets.coingecko.com/coins/images/6319/small/usdc.png';

export function GameVersionSelector() {
  const { navigateToGame } = useGameNavigation();

  return (
    <section className="game-selector-section">
      <h2 className="section-title">🎮 Play VyreJack</h2>

      <div className="game-selector-grid game-selector-single">
        <button className="game-version-card game-version-blue" onClick={() => navigateToGame()}>
          <span className="version-badge">💵 STABLE</span>

          <div className="version-header">
            <img src={USDC_LOGO} alt="USDC" className="version-token-logo" width={48} height={48} />
            <div className="version-titles">
              <h3 className="version-name">VyreJack</h3>
              <span className="version-token">USDC</span>
            </div>
          </div>

          <p className="version-description">On-chain Blackjack with stable dollar betting</p>

          <div className="version-cta">
            <span className="cta-text">🚀 Play Now</span>
            <span className="cta-arrow">→</span>
          </div>
        </button>
      </div>
    </section>
  );
}
