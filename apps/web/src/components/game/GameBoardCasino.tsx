/**
 * GameBoardCasino - Container for VyreCasino game
 *
 * 🏗️ ARCHITECTURE: This is a CONTAINER component that:
 * - Uses hooks for state management
 * - Passes state down to PURE UI components
 * - Preserves game result with snapshot for display
 *
 * ⚡ PERFORMANCE: Uses useTokenBalance for cached balance/allowance reads
 * 🔧 MAINTAINABILITY: Separates reads (useTokenBalance) from writes (useVyreCasinoActions)
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'preact/hooks';
import { useWallet } from '@/context/WalletContext';
import { useVyreCasinoActions } from '@/hooks/useVyreCasinoActions';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useGameStateCasino } from '@/hooks/useGameStateCasino';
import { useTabFocus } from '@/hooks/useTabFocus';
import { GameTable } from './GameTable';
import { BettingPanel } from './BettingPanel';
import { ActionButtons } from './ActionButtons';
import { logger } from '@/lib/logger';
import type { GameResult } from '@vyrejack/shared';
import './styles/casino-table.css';
import './styles/action-buttons.css';

interface GameBoardCasinoProps {
  token: `0x${string}`;
  tokenSymbol: string;
}

// Snapshot of hand when game ends for display during result
interface HandSnapshot {
  playerCards: readonly number[];
  dealerCards: readonly number[];
  playerValue: number;
  dealerValue: number;
  bet: bigint;
  result: GameResult;
}

// How long to display result before clearing (ms)
const RESULT_DISPLAY_DURATION = 4000;

export function GameBoardCasino({ token, tokenSymbol }: GameBoardCasinoProps) {
  const [betAmount, setBetAmount] = useState('10');
  const [lastHand, setLastHand] = useState<HandSnapshot | null>(null);
  const [showingResult, setShowingResult] = useState(false);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGameIdRef = useRef<string | null>(null);

  const wallet = useWallet();
  const isActiveTab = useTabFocus();

  // ⚡ Token balance hook - cached reads with polling
  const {
    formattedBalance,
    isApproved,
    refresh: refreshBalance,
  } = useTokenBalance(token, wallet.address as `0x${string}` | null);

  // ⚡ Game state hook - adaptive polling
  const {
    game,
    playerValue,
    dealerValue,
    isPlayerTurn,
    hasActiveGame,
    isGameEnded,
    refresh: refreshGame,
  } = useGameStateCasino(wallet.address as `0x${string}` | null);

  // Calculate game result from hand values
  const calculateResult = useCallback(
    (pValue: number, dValue: number, pCards: readonly number[]): GameResult => {
      // Check for blackjack (21 with 2 cards)
      if (pValue === 21 && pCards.length === 2) {
        return 'blackjack';
      }
      // Player bust
      if (pValue > 21) {
        return 'lose';
      }
      // Dealer bust
      if (dValue > 21) {
        return 'win';
      }
      // Compare values
      if (pValue > dValue) {
        return 'win';
      }
      if (pValue < dValue) {
        return 'lose';
      }
      // Equal values = push
      return 'push';
    },
    []
  );

  // Detect game end and create snapshot
  useEffect(() => {
    if (!isGameEnded || !game) return;

    // Create unique game ID to prevent duplicate snapshots
    const gameId = `${game.player}-${game.timestamp}-${game.bet}`;
    if (lastGameIdRef.current === gameId) return;
    lastGameIdRef.current = gameId;

    logger.log('[GameBoardCasino] Game ended, creating snapshot');

    const result = calculateResult(playerValue, dealerValue, game.playerCards);

    // Create snapshot before game data resets
    setLastHand({
      playerCards: [...game.playerCards],
      dealerCards: [...game.dealerCards],
      playerValue,
      dealerValue,
      bet: game.bet,
      result,
    });
    setShowingResult(true);

    // Clear result after delay
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
    }
    resultTimeoutRef.current = setTimeout(() => {
      logger.log('[GameBoardCasino] Clearing result display');
      setShowingResult(false);
      setLastHand(null);
      refreshBalance();
      refreshGame();
    }, RESULT_DISPLAY_DURATION);
  }, [isGameEnded, game, playerValue, dealerValue, calculateResult, refreshBalance, refreshGame]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
    };
  }, []);

  // Game WRITE actions hook
  const actions = useVyreCasinoActions({
    address: wallet.address as `0x${string}` | null,
    hasSessionKey: wallet.hasSessionKey ?? false,
    keyPair: wallet.keyPair ?? null,
    onSuccess: () => {
      logger.log('[GameBoardCasino] Action success, refreshing state');
      refreshBalance();
      refreshGame();
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

  // Determine which cards/values to display
  const displayPlayerCards =
    showingResult && lastHand ? lastHand.playerCards : game?.playerCards || [];
  const displayDealerCards =
    showingResult && lastHand ? lastHand.dealerCards : game?.dealerCards || [];
  const displayPlayerValue = showingResult && lastHand ? lastHand.playerValue : playerValue;
  const displayDealerValue = showingResult && lastHand ? lastHand.dealerValue : dealerValue;
  const displayResult = showingResult && lastHand ? lastHand.result : null;
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

        {/* Token Balance Header */}
        <div className="mb-4 text-center">
          <span className="text-gray-400">Your Balance: </span>
          <span className="text-xl font-bold text-white">
            {formattedBalance} {tokenSymbol}
          </span>
          {!isApproved && wallet.isConnected && (
            <span className="ml-2 text-yellow-400 text-sm">(Needs approval)</span>
          )}
        </div>

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
                // Show "New Game" button during result display
                <div className="text-center py-4">
                  <p className="text-white text-lg mb-2">
                    {displayResult === 'win' && '🎉 You Won!'}
                    {displayResult === 'lose' && '😔 Better luck next time'}
                    {displayResult === 'push' && '🤝 Push - Bet returned'}
                    {displayResult === 'blackjack' && '🃏 BLACKJACK!'}
                  </p>
                  <button
                    onClick={() => {
                      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
                      setShowingResult(false);
                      setLastHand(null);
                    }}
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
