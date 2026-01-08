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
 * 🎨 UX FEATURES (v4 - restored from ETH version):
 * - DEGEN result banner with neon colors
 * - Win celebration overlay
 * - Lose shake/flash effects
 * - XP popup on game end
 * - ShareVictory button
 */

import { useState, useMemo, useCallback, useRef } from 'preact/hooks';
import { useWallet } from '@/context/WalletContext';
import { useVyreCasinoActions } from '@/hooks/useVyreCasinoActions';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useGameStateCasino } from '@/hooks/useGameStateCasino';
import { useTabFocus } from '@/hooks/useTabFocus';
import { emitBalanceChange } from '@/lib/balanceEvents';
import { BettingPanel } from './BettingPanel';
import { ActionButtons } from './ActionButtons';
import { XPGainPopup } from './XPGainPopup';
import { ShareVictory } from './ShareVictory';
import { CardDeck } from './CardDeck';
import { Hand, HandValue } from './Hand';
import { logger } from '@/lib/logger';
import type { GameResult } from '@vyrejack/shared';
import './styles/casino-table.css';
import './styles/action-buttons.css';

interface GameBoardCasinoProps {
  token: `0x${string}`;
  tokenSymbol: string;
}

// XP popup state
interface XPPopupState {
  xp: number;
  key: number;
}

export function GameBoardCasino({ token, tokenSymbol }: GameBoardCasinoProps) {
  const [betAmount, setBetAmount] = useState('10');
  const [xpPopup, setXpPopup] = useState<XPPopupState | null>(null);

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

  // XP popup when game ends
  const showXPPopup = useCallback((xp: number) => {
    setXpPopup({ xp, key: Date.now() });
  }, []);

  const hideXPPopup = useCallback(() => {
    setXpPopup(null);
  }, []);

  // Game WRITE actions hook
  const actions = useVyreCasinoActions({
    address: wallet.address as `0x${string}` | null,
    hasSessionKey: wallet.hasSessionKey ?? false,
    keyPair: wallet.keyPair ?? null,
    onSuccess: () => {
      logger.log('[GameBoardCasino] Action success, refreshing state');
      refreshBalance();
      refetchGame(true); // force=true to bypass throttle
      emitBalanceChange();
    },
  });

  // Trigger XP popup when game result shows (win/blackjack = more XP)
  // In production, this should listen to XPAwarded events from useGameStateCasino
  const prevShowingResultRef = useRef(showingResult);
  if (showingResult && !prevShowingResultRef.current && lastGameResult) {
    const xpAmount =
      lastGameResult.result === 'blackjack' ? 100 : lastGameResult.result === 'win' ? 50 : 25;
    setTimeout(() => showXPPopup(xpAmount), 500);
  }
  prevShowingResultRef.current = showingResult;

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
    refetchGame(true); // force=true to bypass throttle
  }, [clearLastResult, refreshBalance, refetchGame]);

  // Determine which cards/values to display
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

  // DEGEN UX result style with neon colors
  const getResultStyle = (result: GameResult) => {
    switch (result) {
      case 'win':
      case 'blackjack':
        return {
          bg: 'bg-gradient-to-r from-emerald-400 via-green-400 to-cyan-400',
          text: 'text-black',
          emoji: result === 'blackjack' ? '💎🙌' : '🚀',
          message: result === 'blackjack' ? 'BLACKJACK! WAGMI!' : 'LFG! YOU WIN!',
        };
      case 'lose':
        return {
          bg: 'bg-gradient-to-r from-red-600 to-rose-600',
          text: 'text-white',
          emoji: '💀',
          message: 'NGMI - DEALER WINS',
        };
      case 'push':
        return {
          bg: 'bg-gradient-to-r from-yellow-400 to-amber-400',
          text: 'text-black',
          emoji: '🤝',
          message: 'PUSH - BET RETURNED',
        };
      default:
        return null;
    }
  };

  const resultStyle = displayResult ? getResultStyle(displayResult) : null;

  // Format bet for display
  const formatBetDisplay = (bet: bigint | undefined) => {
    if (!bet) return '--';
    const decimals = tokenSymbol === 'USDC' ? 6 : 18;
    return (Number(bet) / 10 ** decimals).toFixed(decimals === 6 ? 2 : 0);
  };

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

        {/* Game Area */}
        <div className="space-y-4 sm:space-y-6 md:space-y-8">
          {/* Casino Table with effects */}
          <div
            className={`casino-table ${displayResult === 'blackjack' ? 'blackjack-glow' : ''} ${displayResult === 'lose' ? 'lose-shake' : ''} ${displayResult === 'lose' && displayPlayerValue && displayPlayerValue > 21 ? 'bust' : ''}`}
          >
            {/* Win celebration overlay */}
            {(displayResult === 'win' || displayResult === 'blackjack') && (
              <>
                <div className="win-flash" />
                <div className="win-celebration" />
              </>
            )}

            {/* Loss flash overlay */}
            {displayResult === 'lose' && <div className="lose-flash" />}

            {/* Card Deck - LEFT side */}
            <CardDeck cardsDealt={displayPlayerCards.length + displayDealerCards.length} />

            {/* Play Area */}
            <div className="relative z-10 px-2 sm:px-8 md:px-28 py-4 sm:py-6 md:py-10">
              {/* Dealer Zone */}
              <div className="dealer-zone">
                <div className="zone-label">Dealer</div>
                <div className="zone-row">
                  <div className="zone-spacer" />
                  <div className="play-zone">
                    {displayDealerCards.length > 0 ? (
                      <Hand
                        cards={displayDealerCards}
                        value={displayDealerValue ?? undefined}
                        isDealer
                        hideSecond={hideSecondCard}
                        result={displayResult === 'lose' ? 'win' : null}
                        hideValue
                      />
                    ) : (
                      <span className="play-zone-empty">Deal to start</span>
                    )}
                  </div>
                  {/* Animated value display with colors */}
                  <HandValue
                    value={displayDealerCards.length > 0 ? displayDealerValue : undefined}
                    cardCount={displayDealerCards.length}
                  />
                </div>
              </div>

              {/* Player Zone */}
              <div className="player-zone">
                <div className="zone-row">
                  <div className="zone-spacer" />
                  <div className="play-zone">
                    {displayPlayerCards.length > 0 ? (
                      <Hand
                        cards={displayPlayerCards}
                        value={displayPlayerValue ?? undefined}
                        result={displayResult}
                        hideValue
                      />
                    ) : (
                      <span className="play-zone-empty">Your cards</span>
                    )}
                  </div>
                  {/* Animated value display with colors */}
                  <HandValue
                    value={displayPlayerCards.length > 0 ? displayPlayerValue : undefined}
                    cardCount={displayPlayerCards.length}
                  />
                </div>
                <div className="zone-label">Your Hand</div>
              </div>

              {/* Bet display */}
              <div
                className={`bet-display-side ${displayBet && displayBet > 0n ? '' : 'bet-placeholder'}`}
              >
                <span className="bet-label">BET</span>
                <span className="bet-value">
                  {displayBet && displayBet > 0n
                    ? `${formatBetDisplay(displayBet)} ${tokenSymbol}`
                    : `-- ${tokenSymbol}`}
                </span>
              </div>

              {/* INLINE RESULT BANNER - DEGEN UX */}
              {displayResult && resultStyle && (
                <div className={`result-banner ${resultStyle.bg} ${resultStyle.text}`}>
                  <div className="result-top">
                    <span className="result-emoji">{resultStyle.emoji}</span>
                    <span className="result-message">{resultStyle.message}</span>
                  </div>
                  {/* Score pill */}
                  {lastGameResult && (
                    <span className="result-values">
                      You: {lastGameResult.playerValue} • Dealer: {lastGameResult.dealerValue}
                    </span>
                  )}
                  {/* Share Victory button - only for wins */}
                  {(displayResult === 'win' || displayResult === 'blackjack') && (
                    <div className="mt-3">
                      <ShareVictory
                        outcome={displayResult}
                        winAmount={
                          lastGameResult?.payout
                            ? formatBetDisplay(lastGameResult.payout)
                            : undefined
                        }
                        walletAddress={wallet.address ?? undefined}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* XP Gain Popup */}
              {xpPopup && (
                <XPGainPopup key={xpPopup.key} xpAmount={xpPopup.xp} onComplete={hideXPPopup} />
              )}
            </div>

            {/* Blackjack payout text */}
            <div className="payout-text">Blackjack Pays 3 to 2</div>
          </div>

          {/* Controls */}
          <div className="controls-area-layout">
            <div className="controls-panel">
              {wallet.isConnected ? (
                showingResult ? (
                  // Show "New Game" button after result
                  <div className="space-y-4">
                    <button onClick={handleNewGame} className="deal-btn w-full">
                      <span className="deal-btn-content">
                        <span className="deal-btn-emoji">🎰</span>
                        PLAY AGAIN
                      </span>
                    </button>
                  </div>
                ) : hasActiveGame && isPlayerTurn ? (
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
                  <div className="text-center py-4">
                    <p className="text-yellow-400 animate-pulse">⏳ Waiting for dealer...</p>
                  </div>
                ) : (
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
            <div className="text-center text-sm text-purple-400 bg-purple-900/20 rounded-lg py-3 border border-purple-500/20">
              💡 Enable <strong>Fast Mode</strong> above for instant, popup-free gameplay!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
