/**
 * WinsTicker - Scrolling recent wins (presentation only)
 */

interface Win {
  address: string;
  amount: number;
  game: string;
}

interface WinsTickerProps {
  wins: Win[];
}

export function WinsTicker({ wins }: WinsTickerProps) {
  return (
    <section className="wins-ticker">
      <div className="ticker-label">🎉 RECENT WINS</div>
      <div className="ticker-track">
        <div className="ticker-content">
          {/* Duplicate array for seamless loop */}
          {wins.map((win, i) => (
            <WinItem key={`win-a-${i}`} {...win} />
          ))}
          {wins.map((win, i) => (
            <WinItem key={`win-b-${i}`} {...win} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Internal sub-component
function WinItem({ address, amount }: Win) {
  return (
    <span className="ticker-item">
      <span className="ticker-address">{address}</span>
      <span className="ticker-won">won</span>
      <span className="ticker-amount">{amount} ETH</span>
      <span className="ticker-separator">•</span>
    </span>
  );
}
