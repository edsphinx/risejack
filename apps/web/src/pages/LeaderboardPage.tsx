/**
 * Leaderboard Page
 *
 * Full-page leaderboard with multiple ranking categories
 */

import { Leaderboard } from '@/components/game/Leaderboard';

export function LeaderboardPage() {
  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🏆 Rise Casino Leaderboard</h1>
          <p className="text-gray-400">Compete for glory and climb the ranks</p>
        </div>

        {/* Leaderboard Card */}
        <Leaderboard />

        {/* How to Earn Section */}
        <div className="mt-8 bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
          <h3 className="text-lg font-bold text-white mb-4">How to Earn XP</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-purple-400">🎮</span>
              <span className="text-gray-300">Play a hand: +10 XP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✅</span>
              <span className="text-gray-300">Win: +25 XP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">🃏</span>
              <span className="text-gray-300">Blackjack: +50 XP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">🤝</span>
              <span className="text-gray-300">Push: +5 XP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeaderboardPage;
