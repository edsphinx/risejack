import { GameBoard } from '@/components/game/GameBoard';
import { useWallet } from '@/context/WalletContext';

export function RiseJack() {
  const wallet = useWallet();

  return (
    <div className="risejack-page relative">
      <GameBoard />

      {/* Connection Overlay - shown when wallet not connected */}
      {!wallet.isConnected && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-6">🃏</div>
            <h2 className="text-3xl font-black mb-4 text-white">Connect to Play</h2>
            <p className="text-gray-400 mb-8">
              Connect your Rise Wallet to join the table and start playing RiseJack.
            </p>
            <button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="px-10 py-4 rounded-2xl font-bold text-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 shadow-2xl shadow-purple-500/30"
            >
              {wallet.isConnecting ? '⏳ Connecting...' : '⚡ Connect Wallet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
