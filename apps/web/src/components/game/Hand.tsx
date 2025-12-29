import type { HandProps } from '@risejack/shared';
import { PlayingCard } from './PlayingCard';

export function Hand({
    cards,
    value,
    isSoft,
    isDealer = false,
    hideSecond = false,
    result,
}: HandProps) {
    const resultClass = result === 'win' || result === 'blackjack' ? 'winner' : result === 'lose' ? 'loser' : '';

    return (
        <div className={`flex flex-col items-center gap-2 ${resultClass}`}>
            <div className="text-white/60 text-sm uppercase tracking-wide">
                {isDealer ? 'Dealer' : 'Your Hand'}
            </div>

            <div className="flex relative">
                {cards.map((card, index) => (
                    <div
                        key={`${card}-${index}`}
                        className="relative"
                        style={{ marginLeft: index > 0 ? '-30px' : '0', zIndex: index }}
                    >
                        <PlayingCard
                            cardIndex={card}
                            faceUp={!(isDealer && index === 1 && hideSecond)}
                            delay={index * 100}
                        />
                    </div>
                ))}
            </div>

            {value !== undefined && (
                <div className="bg-black/50 px-4 py-1 rounded-full text-white font-bold">
                    {value}
                    {isSoft && <span className="text-white/60 text-sm ml-1">(soft)</span>}
                </div>
            )}
        </div>
    );
}
