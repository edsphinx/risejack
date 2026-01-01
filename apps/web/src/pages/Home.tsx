/**
 * Home - Casino lobby page
 * Composes subcomponents, minimal logic in this file
 */

import { useLocation } from 'wouter-preact';
import { Logo } from '@/components/brand/Logo';
import { useWallet } from '@/context/WalletContext';
import { FeaturedGameCard } from '@/components/home/FeaturedGameCard';
import { LiveStats } from '@/components/home/LiveStats';
import { WinsTicker } from '@/components/home/WinsTicker';
import { ComingSoonCard } from '@/components/home/ComingSoonCard';
import './styles/home.css';

// Mock data - in production, fetch from backend/contract
const LIVE_STATS = {
  playersOnline: 147,
  totalPot: 4.28,
  biggestWin: 0.89,
};

const RECENT_WINS = [
  { address: '0x7a2f...3f4d', amount: 0.52, game: 'Blackjack' },
  { address: '0xb91c...2c1a', amount: 0.31, game: 'Blackjack' },
  { address: '0x3e8d...9b2c', amount: 1.24, game: 'Blackjack' },
  { address: '0x5f1a...7e3b', amount: 0.18, game: 'Blackjack' },
];

const COMING_SOON_GAMES = [
  { icon: '🎡', title: 'Roulette', description: 'European single-zero' },
  { icon: '🍒', title: 'Rise Slots', description: 'High volatility custom slots' },
  { icon: '🃏', title: 'Video Poker', description: 'Jacks or Better' },
];

export function Home() {
  const [, setLocation] = useLocation();
  const wallet = useWallet();

  const navigateToGame = () => setLocation('/risejack');
  const navigateToSwap = () => setLocation('/swap');
  const navigateToStake = () => setLocation('/stake');

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-glow" />
        <div className="hero-bg-grid" />

        <div className="hero-content">
          {/* Left - Branding & CTA */}
          <div className="hero-left">
            <Logo className="hero-logo" />

            <h1 className="hero-title">
              THE <span className="gradient-text">INSTANT</span> CRYPTO CASINO
            </h1>

            <p className="hero-subtitle">
              10ms finality on Rise Chain • Provably fair • 0.5% house edge
            </p>

            <HeroCTA
              isConnected={wallet.isConnected}
              isConnecting={wallet.isConnecting}
              onConnect={wallet.connect}
              onPlay={navigateToGame}
            />

            <div className="hero-cta-secondary">
              <button onClick={navigateToSwap}>💱 Get CHIP</button>
              <button onClick={navigateToStake}>📈 Earn Yield</button>
            </div>
          </div>

          {/* Right - Featured Game */}
          <div className="hero-right">
            <FeaturedGameCard
              title="RISEJACK"
              description="Classic Blackjack • Instant Payouts"
              playersCount={LIVE_STATS.playersOnline}
              potAmount={LIVE_STATS.totalPot}
              onClick={navigateToGame}
            />
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <LiveStats {...LIVE_STATS} />

      {/* Recent Wins */}
      <WinsTicker wins={RECENT_WINS} />

      {/* Coming Soon Games */}
      <section className="games-section">
        <h2 className="section-title">🎰 All Games</h2>
        <div className="games-grid">
          {COMING_SOON_GAMES.map((game) => (
            <ComingSoonCard key={game.title} {...game} />
          ))}
        </div>
      </section>
    </div>
  );
}

// Internal sub-component for Hero CTA
interface HeroCTAProps {
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onPlay: () => void;
}

function HeroCTA({ isConnected, isConnecting, onConnect, onPlay }: HeroCTAProps) {
  if (!isConnected) {
    return (
      <button className="hero-cta-primary" onClick={onConnect} disabled={isConnecting}>
        {isConnecting ? <>⏳ Connecting...</> : <>⚡ Connect Wallet to Play</>}
      </button>
    );
  }

  return (
    <button className="hero-cta-primary" onClick={onPlay}>
      🎲 Play RiseJack Now
    </button>
  );
}

export default Home;
