/**
 * GameBoardCasino - Container for VyreCasino game
 *
 * 🏗️ ARCHITECTURE: This is a CONTAINER component that:
 * - Uses hooks for state management
 * - Passes state down to PURE UI components
 *
 * ⚡ PERFORMANCE: Uses useTokenBalance for cached balance/allowance reads
 * 🔧 MAINTAINABILITY: Separates reads (useTokenBalance) from writes (useVyreCasinoActions)
 */

import { useState, useMemo, useCallback } from 'preact/hooks';
import { useWallet } from '@/context/WalletContext';
import { useVyreCasinoActions } from '@/hooks/useVyreCasinoActions';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useGameStateCasino } from '@/hooks/useGameStateCasino';
import { useTabFocus } from '@/hooks/useTabFocus';
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

  // ⚡ Game state hook - adaptive polling
  const {
    game,
    playerValue,
    dealerValue,
    isPlayerTurn,
    hasActiveGame,
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
  const canBet = isActiveTab && wallet.isConnected && !actions.isLoading && !hasActiveGame;

  // Callbacks for pure components
  const handlePlaceBet = useCallback(() => {
    actions.placeBet(betAmount, token);
  }, [actions, betAmount, token]);

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
          dealerCards={game?.dealerCards || []}
          dealerValue={dealerValue}
          hideSecond={isPlayerTurn}
          playerCards={game?.playerCards || []}
          playerValue={playerValue}
          betAmount={game?.bet ? (Number(game.bet) / 1e18).toString() : undefined}
          tokenSymbol={tokenSymbol}
          gameResult={null}
        />

        {/* Controls */}
        <div className="controls-area-layout mt-6">
          <div className="controls-panel">
            {wallet.isConnected ? (
              hasActiveGame && isPlayerTurn ? (
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
        {!wallet.hasSessionKey && wallet.isConnected && (
          <div className="text-center text-sm text-purple-400 bg-purple-900/20 rounded-lg py-3 border border-purple-500/20 mt-4">
            💡 Enable <strong>Fast Mode</strong> above for instant, popup-free gameplay!
          </div>
        )}
      </main>
    </div>
  );
}
