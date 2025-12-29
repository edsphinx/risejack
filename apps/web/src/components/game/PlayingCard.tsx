import type { PlayingCardProps } from '@risejack/shared';
import { getCardDisplay } from '../../lib/cards';

export function PlayingCard({
  cardIndex,
  faceUp = true,
  delay = 0,
  isNew = false,
}: PlayingCardProps) {
  const { rank, suit, color } = getCardDisplay(cardIndex);

  return (
    <div
      className={`card w-16 h-24 sm:w-20 sm:h-28 relative ${isNew ? 'deal-animation' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`card-inner w-full h-full ${faceUp ? '' : 'flipped'}`}>
        {/* Card Front */}
        <div className="card-front absolute inset-0 rounded-lg bg-white border-2 border-gray-300 shadow-lg overflow-hidden">
          <div
            className={`h-full flex flex-col justify-between p-1.5 ${color === 'red' ? 'text-red-600' : 'text-gray-900'}`}
          >
            {/* Top Left */}
            <div className="flex flex-col items-start leading-tight">
              <span className="text-sm sm:text-base font-bold">{rank}</span>
              <span className="text-xs sm:text-sm -mt-0.5">{suit}</span>
            </div>

            {/* Center Suit */}
            <div className="flex-1 flex items-center justify-center">
              <span className="text-2xl sm:text-3xl">{suit}</span>
            </div>

            {/* Bottom Right */}
            <div className="flex flex-col items-end leading-tight rotate-180">
              <span className="text-sm sm:text-base font-bold">{rank}</span>
              <span className="text-xs sm:text-sm -mt-0.5">{suit}</span>
            </div>
          </div>
        </div>

        {/* Card Back */}
        <div className="card-back absolute inset-0 rounded-lg bg-gradient-to-br from-blue-800 to-blue-900 border-2 border-blue-700 shadow-lg flex items-center justify-center overflow-hidden">
          <div className="w-10 h-14 sm:w-12 sm:h-16 rounded bg-blue-700/50 border border-blue-600 flex items-center justify-center text-blue-400 text-xl sm:text-2xl">
            ♠
          </div>
        </div>
      </div>
    </div>
  );
}
