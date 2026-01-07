/**
 * GameBoardCasino - Game board for VyreCasino architecture
 *
 * ⚡ PERFORMANCE: Uses useTokenBalance for cached balance/allowance reads
 * 🔧 MAINTAINABILITY: Separates reads (useTokenBalance) from writes (useVyreCasinoActions)
 *
 * Props:
 * - token: Address of ERC20 token to bet with
 * - tokenSymbol: Display symbol (e.g., "CHIP", "USDC")
 */

import { useState, useMemo } from 'preact/hooks';
import { useWallet } from '@/context/WalletContext';
import { useVyreCasinoActions } from '@/hooks/useVyreCasinoActions';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useTabFocus } from '@/hooks/useTabFocus';
import { HandValue } from './Hand';
import { CardDeck } from './CardDeck';
import { logger } from '@/lib/logger';
import './styles/casino-table.css';
import './styles/action-buttons.css';

interface GameBoardCasinoProps {
  token: `0x${string}`;
  tokenSymbol: string;
}

export function GameBoardCasino({ token, tokenSymbol }: GameBoardCasinoProps) {
  const [betAmount, setBetAmount] = useState('10');

  const wallet = useWallet();
  const isActiveTab = useTabFocus();

  // ⚡ Token balance hook - cached reads with polling
  const {
    formattedBalance,
    isApproved,
    refresh: refreshBalance,
  } = useTokenBalance(token, wallet.address as `0x${string}` | null);

  // Game WRITE actions hook
  const actions = useVyreCasinoActions({
    address: wallet.address as `0x${string}` | null,
    hasSessionKey: wallet.hasSessionKey ?? false,
    keyPair: wallet.keyPair ?? null,
    onSuccess: () => {
      logger.log('[GameBoardCasino] Action success, refreshing state');
      refreshBalance();
    },
  });

  // Quick bet amounts based on token
  const quickBets = useMemo(() => {
    if (tokenSymbol === 'USDC') {
      return ['1', '5', '10', '25', '50'];
    }
    return ['10', '50', '100', '500', '1000'];
  }, [tokenSymbol]);

  // Determine if can bet
  const canBet = isActiveTab && wallet.isConnected && !actions.isLoading;

  return (
    <div className="min-h-screen game-board-mobile bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <main className="max-w-6xl mx-auto p-2 sm:p-4 py-4 sm:py-8">
        {/* Error Display */}
        {actions.error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm opacity-80">{actions.error}</p>
              <button className="text-xs underline mt-1" onClick={actions.clearError}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Token Balance */}
        <div className="mb-4 text-center">
          <span className="text-gray-400">Your Balance: </span>
          <span className="text-xl font-bold text-white">
            {formattedBalance} {tokenSymbol}
          </span>
          {!isApproved && wallet.isConnected && (
            <span className="ml-2 text-yellow-400 text-sm">(Needs approval)</span>
          )}
        </div>

        {/* Casino Table */}
        <div className="casino-table">
          {/* Card Deck */}
          <CardDeck cardsDealt={0} />

          {/* Play Area */}
          <div className="relative z-10 px-2 sm:px-8 md:px-28 py-4 sm:py-6 md:py-10">
            {/* Dealer Zone */}
            <div className="dealer-zone">
              <div className="zone-label">Dealer</div>
              <div className="zone-row">
                <div className="zone-spacer" />
                <div className="play-zone">
                  <span className="play-zone-empty">Waiting for game...</span>
                </div>
                <HandValue value={undefined} />
              </div>
            </div>

            {/* Player Zone */}
            <div className="player-zone">
              <div className="zone-row">
                <div className="zone-spacer" />
                <div className="play-zone">
                  <span className="play-zone-empty">Place your bet</span>
                </div>
                <HandValue value={undefined} />
              </div>
              <div className="zone-label">Your Hand</div>
            </div>

            {/* Bet Display */}
            <div className="bet-display-side bet-placeholder">
              <span className="bet-label">BET</span>
              <span className="bet-value">-- {tokenSymbol}</span>
            </div>
          </div>

          <div className="payout-text">Blackjack Pays 3 to 2</div>
        </div>

        {/* Controls */}
        <div className="controls-area-layout mt-6">
          <div className="controls-panel">
            {wallet.isConnected ? (
              <div className="space-y-3 sm:space-y-4">
                {/* Bet Input */}
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount((e.target as HTMLInputElement).value)}
                    min="1"
                    step="1"
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg font-mono focus:border-purple-500 focus:outline-none"
                    placeholder="Bet amount"
                  />
                  <span className="text-slate-400">{tokenSymbol}</span>
                </div>

                {/* Quick Bet Buttons */}
                <div className="quick-bet-container">
                  {quickBets.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setBetAmount(amount)}
                      className={`quick-bet-btn ${betAmount === amount ? 'selected' : ''}`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>

                {/* Deal Button */}
                <button
                  onClick={() => actions.placeBet(betAmount, token)}
                  disabled={!canBet}
                  className="deal-btn"
                >
                  <span className="deal-btn-content">
                    <span className="deal-btn-emoji">🚀</span>
                    {actions.isLoading ? 'SENDING...' : `LET'S GO! ${betAmount} ${tokenSymbol}`}
                  </span>
                </button>

                <p className="text-xs text-slate-500 text-center">
                  Balance: {formattedBalance} {tokenSymbol}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-4">
                <p className="text-gray-400 mb-4 text-center">
                  Connect your wallet to start playing
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Session Key Hint */}
        {!wallet.hasSessionKey && wallet.isConnected && (
          <div className="text-center text-sm text-purple-400 bg-purple-900/20 rounded-lg py-3 border border-purple-500/20 mt-4">
            💡 Enable <strong>Fast Mode</strong> above for instant, popup-free gameplay!
          </div>
        )}
      </main>
    </div>
  );
}
