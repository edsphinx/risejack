import type { PlayingCardProps } from '@risejack/shared';
import { getCardDisplay } from '../../lib/cards';

export function PlayingCard({
  cardIndex,
  faceUp = true,
  delay = 0,
  isNew = false,
}: PlayingCardProps) {
  const { rank, suit, color } = getCardDisplay(cardIndex);

  const textColor = color === 'red' ? 'text-red-500' : 'text-slate-800';

  return (
    <div
      className={`card relative ${isNew ? 'deal-animation' : ''}`}
      style={{
        animationDelay: `${delay}ms`,
        width: '60px',
        height: '84px',
        perspective: '1000px',
      }}
    >
      <div
        className={`card-inner w-full h-full transition-transform duration-500 ${faceUp ? '' : 'flipped'}`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Card Front */}
        <div
          className="card-front absolute inset-0 rounded-md bg-white shadow-xl"
          style={{
            backfaceVisibility: 'hidden',
            border: '1px solid #e5e7eb',
          }}
        >
          <div className={`h-full flex flex-col ${textColor}`}>
            {/* Top corner */}
            <div className="px-1 pt-0.5">
              <div className="text-xs font-bold leading-none">{rank}</div>
              <div className="text-xs leading-none">{suit}</div>
            </div>

            {/* Center suit - larger */}
            <div className="flex-1 flex items-center justify-center -mt-1">
              <span className="text-2xl">{suit}</span>
            </div>

            {/* Bottom corner - rotated */}
            <div className="px-1 pb-0.5 rotate-180">
              <div className="text-xs font-bold leading-none">{rank}</div>
              <div className="text-xs leading-none">{suit}</div>
            </div>
          </div>
        </div>

        {/* Card Back */}
        <div
          className="card-back absolute inset-0 rounded-md shadow-xl"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #172554 100%)',
            border: '1px solid #1e40af',
          }}
        >
          {/* Pattern */}
          <div className="w-full h-full flex items-center justify-center p-1.5">
            <div
              className="w-full h-full rounded border border-blue-400/30 flex items-center justify-center"
              style={{
                background:
                  'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(59, 130, 246, 0.1) 3px, rgba(59, 130, 246, 0.1) 6px)',
              }}
            >
              <span className="text-blue-300/60 text-lg">♠</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
