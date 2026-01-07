/**
 * VyreJack ETH Version
 *
 * Legacy standalone version using native ETH betting.
 * Uses VyreJack.sol (standalone) - NOT VyreCasino architecture.
 */
import { GameBoard } from '@/components/game/GameBoard';
import { useWallet } from '@/context/WalletContext';

export function VyreJackEth() {
  const wallet = useWallet();

  return (
    <div className="vyrejack-page relative">
      <GameBoard />

      {/* Connection Overlay - shown when wallet not connected */}
      {!wallet.isConnected && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-6">🃏</div>
            <h2 className="text-3xl font-black mb-4 text-white">VyreJack ETH</h2>
            <p className="text-emerald-400 mb-2 font-semibold">Play with ETH</p>
            <p className="text-gray-400 mb-8">
              Connect your Rise Wallet to join the table and start playing.
            </p>
            <button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="px-10 py-4 rounded-2xl font-bold text-xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50 shadow-2xl shadow-emerald-500/30"
            >
              {wallet.isConnecting ? '⏳ Connecting...' : '⚡ Connect Wallet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VyreJackEth;
