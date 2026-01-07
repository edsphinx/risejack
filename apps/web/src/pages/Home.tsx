/**
 * Home - Casino lobby page
 * Composes subcomponents, minimal logic in this file
 */

import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import { Logo } from '@/components/brand/Logo';
import { ChipIcon } from '@/components/icons/ChipIcon';
import { useWallet } from '@/context/WalletContext';
import { FeaturedGameCard } from '@/components/home/FeaturedGameCard';
import { LiveStats } from '@/components/home/LiveStats';
import { LiveWinsTicker } from '@/components/home/LiveWinsTicker';
import { ComingSoonCard } from '@/components/home/ComingSoonCard';
import { LeaderboardPreview } from '@/components/home/LeaderboardPreview';
import { PoweredByRise } from '@/components/home/PoweredByRise';
import { Footer } from '@/components/common/Footer';
import { FaucetModal, useFaucetCanClaim } from '@/components/wallet/FaucetModal';
import './styles/home.css';

// Mock data - in production, fetch from backend/contract
const LIVE_STATS = {
  playersOnline: 147,
  totalPot: 4.28,
  biggestWin: 0.89,
};

const COMING_SOON_GAMES = [
  { icon: '🎡', title: 'Roulette', description: 'European single-zero' },
  { icon: '🍒', title: 'Rise Slots', description: 'High volatility custom slots' },
  { icon: '🃏', title: 'Video Poker', description: 'Jacks or Better' },
];

export function Home() {
  const [, setLocation] = useLocation();
  const wallet = useWallet();

  const navigateToGame = () => setLocation('/vyrejack');
  const navigateToStake = () => setLocation('/stake');

  // Faucet modal state
  const [faucetOpen, setFaucetOpen] = useState(false);
  const canClaimFaucet = useFaucetCanClaim();

  // Auto-open faucet modal when user can claim (first time)
  useEffect(() => {
    if (canClaimFaucet && wallet.isConnected) {
      // Small delay to not overwhelm user right after connect
      const timer = setTimeout(() => setFaucetOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [canClaimFaucet, wallet.isConnected]);

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
              <button onClick={() => setFaucetOpen(true)} className="hero-cta-chip">
                <ChipIcon size={18} /> Get CHIP
              </button>
              <button onClick={navigateToStake}>📈 Earn Yield</button>
            </div>
          </div>

          {/* Right - Leaderboard (expanded) */}
          <div className="hero-right">
            <LeaderboardPreview />
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <LiveStats {...LIVE_STATS} />

      {/* Live Wins - Real-time via Shreds WebSocket */}
      <LiveWinsTicker />

      {/* Powered by Rise - Showcasing Rise Chain tech */}
      <PoweredByRise />

      {/* Featured Games Section */}
      <section className="featured-section">
        <h2 className="section-title">🔥 Featured Game</h2>
        <FeaturedGameCard
          title="VYREJACK"
          description="Classic Blackjack • Instant Payouts"
          playersCount={LIVE_STATS.playersOnline}
          potAmount={LIVE_STATS.totalPot}
          onClick={navigateToGame}
          showCTA={true}
        />
      </section>

      {/* Coming Soon Games */}
      <section className="games-section">
        <h2 className="section-title">🎰 All Games</h2>
        <div className="games-grid">
          {COMING_SOON_GAMES.map((game) => (
            <ComingSoonCard key={game.title} {...game} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Faucet Modal */}
      <FaucetModal isOpen={faucetOpen} onClose={() => setFaucetOpen(false)} />
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
      <img src="/assets/suits/spade.svg" alt="" className="cta-spade-icon" />
      Play VyreJack Now
    </button>
  );
}

export default Home;
