/**
 * FeaturedGameCard - Highlighted game preview card
 * Shows game info, stats, and optional CTA button
 */

interface FeaturedGameCardProps {
  title: string;
  description: string;
  playersCount: number;
  potAmount: number;
  onClick: () => void;
  showCTA?: boolean;
}

export function FeaturedGameCard({
  title,
  description,
  playersCount,
  potAmount,
  onClick,
  showCTA = false,
}: FeaturedGameCardProps) {
  return (
    <div className="featured-game-card">
      <div className="game-card-badge">🔥 HOT</div>

      <div className="game-card-visual">
        <div className="preview-cards">
          <div className="preview-card card-1">A♠</div>
          <div className="preview-card card-2">K♥</div>
        </div>
      </div>

      <div className="game-card-info">
        <h3 className="game-card-title">{title}</h3>
        <p className="game-card-desc">{description}</p>

        <div className="game-card-stats">
          <span>🎮 {playersCount} playing</span>
          <span>💰 {potAmount} ETH pot</span>
        </div>

        {showCTA && (
          <button className="game-card-cta" onClick={onClick}>
            <img src="/assets/suits/spade.svg" alt="" className="cta-card-icon" />
            Play Now
          </button>
        )}
      </div>
    </div>
  );
}
