import { Link, useLocation } from 'wouter-preact';
import { Logo } from '@/components/brand/Logo';

export function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="home-page min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        {/* Background gradient/glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl bg-gradient-to-b from-purple-900/40 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="mb-6 flex justify-center">
            <Logo className="w-64 h-auto" />
          </div>

          <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">
            THE{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              INSTANT
            </span>{' '}
            CRYPTO CASINO
          </h1>

          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Experience 10ms finality on Rise Chain. No popups. Real yield. Provably fair.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
              onClick={() => setLocation('/swap')}
            >
              Get CHIP Tokens
            </button>
            <button
              className="px-8 py-3 bg-purple-600/20 text-purple-300 border border-purple-500/50 font-bold rounded-full hover:bg-purple-600/30 transition-colors"
              onClick={() => setLocation('/stake')}
            >
              Earn Yield
            </button>
          </div>
        </div>
      </section>

      {/* Featured Game */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span className="text-2xl">🔥</span> Trending Now
        </h2>

        <Link
          href="/risejack"
          className="group block relative cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-gray-900 hover:border-purple-500/50 transition-all duration-300"
        >
          {/* Game Banner Image (CSS gradient) */}
          <div className="h-48 bg-gradient-to-br from-slate-800 to-black relative overflow-hidden">
            {/* Pattern background using CSS */}
            <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-purple-500/20 to-transparent"></div>

            <div className="absolute bottom-0 left-0 p-6 z-10">
              <h3 className="text-3xl font-black italic tracking-wide text-white group-hover:text-purple-400 transition-colors">
                RISEJACK
              </h3>
              <p className="text-gray-400 text-sm">Classic Blackjack • 0.5% Edge • Instant</p>
            </div>

            <div className="absolute top-4 right-4 bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full animate-pulse">
              LIVE
            </div>
          </div>
        </Link>
      </section>

      {/* Other Games */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">All Games</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Roulette Card */}
          <div className="rounded-xl bg-gray-900/50 border border-white/5 p-6 opacity-75 grayscale hover:grayscale-0 transition-all cursor-not-allowed relative">
            <div className="absolute top-3 right-3 bg-gray-700 text-xs px-2 py-1 rounded">
              Coming Soon
            </div>
            <div className="text-4xl mb-4">🎰</div>
            <h3 className="text-xl font-bold mb-1">Roulette</h3>
            <p className="text-sm text-gray-500">European style single-zero</p>
          </div>

          {/* Slots Card */}
          <div className="rounded-xl bg-gray-900/50 border border-white/5 p-6 opacity-75 grayscale hover:grayscale-0 transition-all cursor-not-allowed relative">
            <div className="absolute top-3 right-3 bg-gray-700 text-xs px-2 py-1 rounded">
              Coming Soon
            </div>
            <div className="text-4xl mb-4">🍒</div>
            <h3 className="text-xl font-bold mb-1">Rise Slots</h3>
            <p className="text-sm text-gray-500">High volatility custom slots</p>
          </div>
        </div>
      </section>
    </div>
  );
}
