/**
 * GameBoardCasino - Container for VyreCasino game
 *
 * 🏗️ ARCHITECTURE: This is a CONTAINER component that:
 * - Uses hooks for state management (all business logic in hooks)
 * - Passes state down to PURE UI components
 *
 * ⚡ PERFORMANCE:
 * - NO POLLING for game state (WebSocket events)
 * - Card accumulation from real-time events
 * - Snapshot mechanism preserves cards at game end
 *
 * 🔧 MAINTAINABILITY:
 * - Separates reads (useGameStateCasino) from writes (useVyreCasinoActions)
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

  // ⚡ Game state hook - WebSocket events + card accumulation + snapshots
  const {
    game,
    playerValue,
    dealerValue,
    isPlayerTurn,
    hasActiveGame,
    showingResult,
    lastGameResult,
    clearLastResult,
    refetch: refetchGame,
    snapshotCards,
    accumulatedCards,
  } = useGameStateCasino(wallet.address as `0x${string}` | null);

  // Game WRITE actions hook
  const actions = useVyreCasinoActions({
    address: wallet.address as `0x${string}` | null,
    hasSessionKey: wallet.hasSessionKey ?? false,
    keyPair: wallet.keyPair ?? null,
    onSuccess: () => {
      logger.log('[GameBoardCasino] Action success, refreshing state');
      refreshBalance();
      refetchGame();
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

  // Wrapped actions that take snapshot before executing
  const handlePlaceBet = useCallback(() => {
    // Clear previous result
    clearLastResult();
    actions.placeBet(betAmount, token);
  }, [actions, betAmount, token, clearLastResult]);

  const handleHit = useCallback(() => {
    snapshotCards();
    actions.hit();
  }, [actions, snapshotCards]);

  const handleStand = useCallback(() => {
    snapshotCards();
    actions.stand();
  }, [actions, snapshotCards]);

  const handleDouble = useCallback(() => {
    snapshotCards();
    actions.double();
  }, [actions, snapshotCards]);

  const handleNewGame = useCallback(() => {
    clearLastResult();
    refreshBalance();
    refetchGame();
  }, [clearLastResult, refreshBalance, refetchGame]);

  // Determine which cards/values to display
  // Priority: accumulated > snapshot (lastGameResult) > contract state
  const displayPlayerCards = useMemo(() => {
    if (showingResult && lastGameResult) {
      return lastGameResult.playerCards;
    }
    if (accumulatedCards.playerCards.length >= 2) {
      return accumulatedCards.playerCards;
    }
    return game?.playerCards ?? [];
  }, [showingResult, lastGameResult, accumulatedCards, game]);

  const displayDealerCards = useMemo(() => {
    if (showingResult && lastGameResult) {
      return lastGameResult.dealerCards;
    }
    if (accumulatedCards.dealerCards.length >= 1) {
      return accumulatedCards.dealerCards;
    }
    return game?.dealerCards ?? [];
  }, [showingResult, lastGameResult, accumulatedCards, game]);

  const displayPlayerValue =
    showingResult && lastGameResult ? lastGameResult.playerValue : playerValue;
  const displayDealerValue =
    showingResult && lastGameResult ? lastGameResult.dealerValue : dealerValue;
  const displayBet = showingResult && lastGameResult ? lastGameResult.bet : game?.bet;
  const displayResult = showingResult && lastGameResult ? lastGameResult.result : null;

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
          gameResult={displayResult}
        />

        {/* Controls */}
        <div className="controls-area-layout mt-6">
          <div className="controls-panel">
            {wallet.isConnected ? (
              showingResult ? (
                // Show result message and "New Game" button
                <div className="text-center py-4">
                  <p className="text-white text-lg mb-2">
                    {displayResult === 'win' && '🎉 You Won!'}
                    {displayResult === 'lose' && '😔 Better luck next time'}
                    {displayResult === 'push' && '🤝 Push - Bet returned'}
                    {displayResult === 'blackjack' && '🃏 BLACKJACK!'}
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
                  onHit={handleHit}
                  onStand={handleStand}
                  onDouble={handleDouble}
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
