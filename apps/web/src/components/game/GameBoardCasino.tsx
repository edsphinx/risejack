/**
 * GameBoardCasino - Container for VyreCasino game
 *
 * 🏗️ ARCHITECTURE: This is a CONTAINER component that:
 * - Uses hooks for state management (all business logic in hooks)
 * - Passes state down to PURE UI components
 *
 * ⚡ PERFORMANCE: Uses useTokenBalance for cached balance/allowance reads
 * 🔧 MAINTAINABILITY:
 * - Separates reads (useTokenBalance) from writes (useVyreCasinoActions)
 * - NO business logic in component - all in hooks
 */

import { useState, useMemo, useCallback } from 'preact/hooks';
import { useWallet } from '@/context/WalletContext';
import { useVyreCasinoActions } from '@/hooks/useVyreCasinoActions';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useGameStateCasino } from '@/hooks/useGameStateCasino';
import { useTabFocus } from '@/hooks/useTabFocus';
import { emitBalanceChange } from '@/lib/balanceEvents';
import { GameTable } from './GameTable';
import { BettingPanel } from './BettingPanel';
import { ActionButtons } from './ActionButtons';
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

  // ⚡ Game state hook - adaptive polling + result preservation
  const {
    game,
    playerValue,
    dealerValue,
    isPlayerTurn,
    hasActiveGame,
    showingResult,
    gameResult,
    lastHand,
    clearResult,
    refresh: refreshGame,
  } = useGameStateCasino(wallet.address as `0x${string}` | null);

  // Game WRITE actions hook
  const actions = useVyreCasinoActions({
    address: wallet.address as `0x${string}` | null,
    hasSessionKey: wallet.hasSessionKey ?? false,
    keyPair: wallet.keyPair ?? null,
    onSuccess: () => {
      logger.log('[GameBoardCasino] Action success, refreshing state');
      refreshBalance();
      refreshGame();
      // Emit global event for header balance update
      emitBalanceChange();
    },
  });

  // Quick bet amounts based on token
  const quickBets = useMemo(() => {
    if (tokenSymbol === 'USDC') {
      return ['1', '5', '10', '25', '50'];
    }
    return ['10', '50', '100', '500', '1000'];
  }, [tokenSymbol]);

  // Determine if can bet (not showing result, no active game)
  const canBet =
    isActiveTab && wallet.isConnected && !actions.isLoading && !hasActiveGame && !showingResult;

  // Callbacks for pure components
  const handlePlaceBet = useCallback(() => {
    actions.placeBet(betAmount, token);
  }, [actions, betAmount, token]);

  const handleNewGame = useCallback(() => {
    clearResult();
    refreshBalance();
    refreshGame();
  }, [clearResult, refreshBalance, refreshGame]);

  // Determine which cards/values to display (use snapshot during result)
  const displayPlayerCards =
    showingResult && lastHand ? lastHand.playerCards : game?.playerCards || [];
  const displayDealerCards =
    showingResult && lastHand ? lastHand.dealerCards : game?.dealerCards || [];
  const displayPlayerValue = showingResult && lastHand ? lastHand.playerValue : playerValue;
  const displayDealerValue = showingResult && lastHand ? lastHand.dealerValue : dealerValue;
  const displayBet = showingResult && lastHand ? lastHand.bet : game?.bet;

  // Hide dealer's second card during player turn (not during result)
  const hideSecondCard = isPlayerTurn && !showingResult;

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

        {/* 🧱 PURE: Game Table Component */}
        <GameTable
          dealerCards={[...displayDealerCards]}
          dealerValue={displayDealerValue}
          hideSecond={hideSecondCard}
          playerCards={[...displayPlayerCards]}
          playerValue={displayPlayerValue}
          betAmount={displayBet ? (Number(displayBet) / 1e18).toString() : undefined}
          tokenSymbol={tokenSymbol}
          gameResult={gameResult}
        />

        {/* Controls */}
        <div className="controls-area-layout mt-6">
          <div className="controls-panel">
            {wallet.isConnected ? (
              showingResult ? (
                // Show result message and "New Game" button
                <div className="text-center py-4">
                  <p className="text-white text-lg mb-2">
                    {gameResult === 'win' && '🎉 You Won!'}
                    {gameResult === 'lose' && '😔 Better luck next time'}
                    {gameResult === 'push' && '🤝 Push - Bet returned'}
                    {gameResult === 'blackjack' && '🃏 BLACKJACK!'}
                  </p>
                  <button
                    onClick={handleNewGame}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl transition-all"
                  >
                    🎰 New Game
                  </button>
                </div>
              ) : hasActiveGame && isPlayerTurn ? (
                // 🧱 PURE: Action Buttons (during game)
                <ActionButtons
                  onHit={actions.hit}
                  onStand={actions.stand}
                  onDouble={actions.double}
                  onSurrender={() => {}}
                  canDouble={game?.playerCards.length === 2}
                  canSurrender={false}
                  isLoading={actions.isLoading}
                />
              ) : hasActiveGame ? (
                // Game in progress but not player's turn (dealer turn / waiting VRF)
                <div className="text-center py-4">
                  <p className="text-yellow-400 animate-pulse">⏳ Waiting for dealer...</p>
                </div>
              ) : (
                // 🧱 PURE: Betting Panel (before game)
                <BettingPanel
                  betAmount={betAmount}
                  balance={formattedBalance}
                  tokenSymbol={tokenSymbol}
                  isApproved={isApproved}
                  isLoading={actions.isLoading}
                  canBet={canBet}
                  onBetAmountChange={setBetAmount}
                  onPlaceBet={handlePlaceBet}
                  quickBets={quickBets}
                />
              )
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
        {!wallet.hasSessionKey && wallet.isConnected && !showingResult && (
          <div className="text-center text-sm text-purple-400 bg-purple-900/20 rounded-lg py-3 border border-purple-500/20 mt-4">
            💡 Enable <strong>Fast Mode</strong> above for instant, popup-free gameplay!
          </div>
        )}
      </main>
    </div>
  );
}
