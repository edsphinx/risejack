import type { PlayingCardProps } from '@risejack/shared';
import { getCardDisplay, getCardImageUrl, getCardBackUrl } from '@/lib/cards';
import './styles/playing-card.css';

interface EnhancedPlayingCardProps extends PlayingCardProps {
  /** Card is dealing from deck - starts off-screen */
  isDealing?: boolean;
  /** Index in deal sequence for stagger timing */
  dealIndex?: number;
  /** Callback when deal animation completes */
  onDealComplete?: () => void;
}

export function PlayingCard({
  cardIndex,
  faceUp = true,
  delay = 0,
  isNew = false,
  isDealing = false,
  dealIndex = 0,
  onDealComplete,
}: EnhancedPlayingCardProps) {
  const { rank, suit } = getCardDisplay(cardIndex);
  const cardImageUrl = getCardImageUrl(cardIndex);
  const cardBackUrl = getCardBackUrl();

  // Calculate deal delay based on position in sequence
  const dealDelay = dealIndex * 200;

  const handleAnimationEnd = (e: { animationName: string }) => {
    if (e.animationName === 'deal-from-deck' && onDealComplete) {
      onDealComplete();
    }
  };

  return (
    <div
      className={`playing-card ${isNew ? 'deal-animation' : ''} ${isDealing ? 'dealing-from-deck' : ''}`}
      style={{
        animationDelay: isDealing ? `${dealDelay}ms` : `${delay}ms`,
        '--deal-delay': `${dealDelay}ms`,
      }}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className={`card-inner ${faceUp ? '' : 'flipped'}`}>
        {/* Card Front - PNG Image */}
        <div className="card-front">
          <img
            src={cardImageUrl}
            alt={`${rank} of ${suit}`}
            className="card-image"
            loading="lazy"
            draggable={false}
          />
        </div>

        {/* Card Back - PNG Image */}
        <div className="card-back">
          <img
            src={cardBackUrl}
            alt="Card back"
            className="card-image"
            loading="lazy"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
