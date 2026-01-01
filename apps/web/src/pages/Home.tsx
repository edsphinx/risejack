import { useLocation } from 'wouter-preact';
import { Logo } from '@/components/brand/Logo';
import { useWallet } from '@/context/WalletContext';
import './styles/home.css';

// Simulated live stats (in production, fetch from backend)
const LIVE_STATS = {
  playersOnline: 147,
  totalPot: 4.28,
  biggestWin: 0.89,
};

// Simulated recent wins (in production, fetch from contract events)
const RECENT_WINS = [
  { address: '0x7a2f...3f4d', amount: 0.52, game: 'Blackjack' },
  { address: '0xb91c...2c1a', amount: 0.31, game: 'Blackjack' },
  { address: '0x3e8d...9b2c', amount: 1.24, game: 'Blackjack' },
  { address: '0x5f1a...7e3b', amount: 0.18, game: 'Blackjack' },
];

export function Home() {
  const [, setLocation] = useLocation();
  const wallet = useWallet();

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        {/* Background effects */}
        <div className="hero-bg-glow" />
        <div className="hero-bg-grid" />

        <div className="hero-content">
          {/* Left side - Branding & CTA */}
          <div className="hero-left">
            <Logo className="hero-logo" />

            <h1 className="hero-title">
              THE <span className="gradient-text">INSTANT</span> CRYPTO CASINO
            </h1>

            <p className="hero-subtitle">
              10ms finality on Rise Chain • Provably fair • 0.5% house edge
            </p>

            {/* Primary CTA - Connect or Play */}
            {!wallet.isConnected ? (
              <button
                className="hero-cta-primary"
                onClick={wallet.connect}
                disabled={wallet.isConnecting}
              >
                {wallet.isConnecting ? <>⏳ Connecting...</> : <>⚡ Connect Wallet to Play</>}
              </button>
            ) : (
              <button className="hero-cta-primary" onClick={() => setLocation('/risejack')}>
                🎲 Play RiseJack Now
              </button>
            )}

            {/* Secondary CTAs */}
            <div className="hero-cta-secondary">
              <button onClick={() => setLocation('/swap')}>💱 Get CHIP</button>
              <button onClick={() => setLocation('/stake')}>📈 Earn Yield</button>
            </div>
          </div>

          {/* Right side - Featured Game Preview */}
          <div className="hero-right">
            <div className="featured-game-card" onClick={() => setLocation('/risejack')}>
              <div className="game-card-badge">🔥 HOT</div>

              <div className="game-card-visual">
                {/* Animated cards */}
                <div className="preview-cards">
                  <div className="preview-card card-1">A♠</div>
                  <div className="preview-card card-2">K♥</div>
                </div>
              </div>

              <div className="game-card-info">
                <h3 className="game-card-title">RISEJACK</h3>
                <p className="game-card-desc">Classic Blackjack • Instant Payouts</p>

                <div className="game-card-stats">
                  <span>🎮 {LIVE_STATS.playersOnline} playing</span>
                  <span>💰 {LIVE_STATS.totalPot} ETH pot</span>
                </div>

                <button className="game-card-cta">PLAY NOW →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stats Bar */}
      <section className="stats-bar">
        <div className="stat-item">
          <span className="stat-icon">🎮</span>
          <div className="stat-content">
            <span className="stat-value">{LIVE_STATS.playersOnline}</span>
            <span className="stat-label">Players Online</span>
          </div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-icon">💰</span>
          <div className="stat-content">
            <span className="stat-value">{LIVE_STATS.totalPot} ETH</span>
            <span className="stat-label">Total Pot</span>
          </div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-icon">🏆</span>
          <div className="stat-content">
            <span className="stat-value">{LIVE_STATS.biggestWin} ETH</span>
            <span className="stat-label">Biggest Win Today</span>
          </div>
        </div>
      </section>

      {/* Recent Wins Ticker */}
      <section className="wins-ticker">
        <div className="ticker-label">🎉 RECENT WINS</div>
        <div className="ticker-track">
          <div className="ticker-content">
            {[...RECENT_WINS, ...RECENT_WINS].map((win, i) => (
              <span key={i} className="ticker-item">
                <span className="ticker-address">{win.address}</span>
                <span className="ticker-won">won</span>
                <span className="ticker-amount">{win.amount} ETH</span>
                <span className="ticker-separator">•</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Other Games */}
      <section className="games-section">
        <h2 className="section-title">🎰 All Games</h2>

        <div className="games-grid">
          {/* Roulette - Coming Soon */}
          <div className="game-card-disabled">
            <div className="coming-soon-badge">Coming Soon</div>
            <div className="game-icon">🎡</div>
            <h3>Roulette</h3>
            <p>European single-zero</p>
          </div>

          {/* Slots - Coming Soon */}
          <div className="game-card-disabled">
            <div className="coming-soon-badge">Coming Soon</div>
            <div className="game-icon">🍒</div>
            <h3>Rise Slots</h3>
            <p>High volatility custom slots</p>
          </div>

          {/* Poker - Coming Soon */}
          <div className="game-card-disabled">
            <div className="coming-soon-badge">Coming Soon</div>
            <div className="game-icon">🃏</div>
            <h3>Video Poker</h3>
            <p>Jacks or Better</p>
          </div>
        </div>
      </section>
    </div>
  );
}
