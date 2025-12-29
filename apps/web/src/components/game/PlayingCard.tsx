import type { PlayingCardProps } from '@risejack/shared';
import { getCardDisplay } from '../../lib/cards';

export function PlayingCard({ cardIndex, faceUp = true, delay = 0, isNew = false }: PlayingCardProps) {
    const { rank, suit, color } = getCardDisplay(cardIndex);

    return (
        <div
            className={`card w-20 h-28 relative ${isNew ? 'deal-animation' : ''}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className={`card-inner w-full h-full ${faceUp ? '' : 'flipped'}`}>
                {/* Card Front */}
                <div className="card-front absolute inset-0 rounded-lg bg-white border-2 border-gray-200 shadow-lg p-2">
                    <div className={`h-full flex flex-col justify-between ${color === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-lg font-bold">{rank}</span>
                            <span className="text-sm">{suit}</span>
                        </div>
                        <div className="flex items-center justify-center">
                            <span className="text-4xl">{suit}</span>
                        </div>
                        <div className="flex flex-col items-end leading-none rotate-180">
                            <span className="text-lg font-bold">{rank}</span>
                            <span className="text-sm">{suit}</span>
                        </div>
                    </div>
                </div>

                {/* Card Back */}
                <div className="card-back absolute inset-0 rounded-lg bg-gradient-to-br from-blue-800 to-blue-900 border-2 border-blue-700 shadow-lg flex items-center justify-center">
                    <div className="w-12 h-16 rounded bg-blue-700/50 border border-blue-600 flex items-center justify-center text-blue-400 text-2xl">
                        ♠
                    </div>
                </div>
            </div>
        </div>
    );
}
