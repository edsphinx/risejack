/**
 * VyreJack CHIP Version
 *
 * Uses VyreCasino architecture with CHIP betting token.
 * Premium interface with animated poker chips (Phase 4).
 *
 * For now, uses same GameBoardCasino as USDC.
 * TODO: Add chip animations in Phase 4.
 */
import { GameBoardCasino } from '@/components/game/GameBoardCasino';
import { useWallet } from '@/context/WalletContext';
import { CHIP_TOKEN_ADDRESS } from '@/lib/contract';

export function VyreJackChip() {
  const wallet = useWallet();

  return (
    <div className="vyrejack-page relative">
      <GameBoardCasino token={CHIP_TOKEN_ADDRESS} tokenSymbol="CHIP" />

      {/* Connection Overlay - shown when wallet not connected */}
      {!wallet.isConnected && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-6">🎰</div>
            <h2 className="text-3xl font-black mb-4 text-white">VyreJack CHIP</h2>
            <p className="text-amber-400 mb-2 font-semibold">Play with Casino Chips</p>
            <p className="text-gray-400 mb-8">The premium casino experience with CHIP tokens.</p>
            <button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="px-10 py-4 rounded-2xl font-bold text-xl text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 transition-all disabled:opacity-50 shadow-2xl shadow-amber-500/30"
            >
              {wallet.isConnecting ? '⏳ Connecting...' : '⚡ Connect Wallet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VyreJackChip;
