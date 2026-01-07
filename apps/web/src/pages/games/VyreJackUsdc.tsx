/**
 * VyreJack USDC Version
 *
 * Uses VyreCasino architecture with USDC betting token.
 * Clean, simple interface for stablecoin players.
 */
import { GameBoardCasino } from '@/components/game/GameBoardCasino';
import { useWallet } from '@/context/WalletContext';
import { USDC_TOKEN_ADDRESS } from '@/lib/contract';

export function VyreJackUsdc() {
  const wallet = useWallet();

  return (
    <div className="vyrejack-page relative">
      <GameBoardCasino token={USDC_TOKEN_ADDRESS} tokenSymbol="USDC" />

      {/* Connection Overlay - shown when wallet not connected */}
      {!wallet.isConnected && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-6">💵</div>
            <h2 className="text-3xl font-black mb-4 text-white">VyreJack USDC</h2>
            <p className="text-blue-400 mb-2 font-semibold">Play with Stablecoins</p>
            <p className="text-gray-400 mb-8">Connect your Rise Wallet and play with USDC.</p>
            <button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="px-10 py-4 rounded-2xl font-bold text-xl text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all disabled:opacity-50 shadow-2xl shadow-blue-500/30"
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
