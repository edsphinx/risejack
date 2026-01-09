/**
 * VyreJack USDC Version
 *
 * Uses VyreCasino architecture with USDC betting token.
 * Approval is handled automatically when placing bets.
 * Preloads resources on mount for fast first game.
 */
import { GameBoardCasino } from '@/components/game/GameBoardCasino';
import { useWallet } from '@/context/WalletContext';
import { useGameWarmup } from '@/hooks/useGameWarmup';
import { USDC_TOKEN_ADDRESS } from '@/lib/contract';

export function VyreJackUsdc() {
  const wallet = useWallet();

  // ⚡ Preload resources on mount for fast first game
  useGameWarmup(wallet.address as `0x${string}` | null);

  return (
    <div className="vyrejack-page relative">
      {/* Game Board - Rise Wallet handles approval when betting */}
      {wallet.isConnected && <GameBoardCasino token={USDC_TOKEN_ADDRESS} tokenSymbol="USDC" />}

      {/* Connection Overlay - shown when wallet not connected */}
      {!wallet.isConnected && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-6">🎰</div>
            <h2 className="text-3xl font-black mb-4 text-white">VyreJack USDC</h2>
            <p className="text-sky-400 mb-2 font-semibold">Play with Stablecoins</p>
            <p className="text-gray-400 mb-8">Stable value betting with USDC.</p>
            <button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="px-10 py-4 rounded-2xl font-bold text-xl text-white bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 transition-all disabled:opacity-50 shadow-2xl shadow-sky-500/30"
            >
              {wallet.isConnecting ? '⏳ Connecting...' : '⚡ Connect Wallet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VyreJackUsdc;
