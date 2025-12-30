import { useState, useEffect } from 'preact/hooks';
import { useRiseWallet } from '@/hooks/useRiseWallet';
import { useGameState } from '@/hooks/useGameState';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { Hand, HandValue } from './Hand';
import { ActionButtons } from './ActionButtons';
import { CardDeck } from './CardDeck';
import { ContractService } from '@/services';
import { GameState, type GameResult } from '@risejack/shared';
import './styles/casino-table.css';

// Snapshot of hand when game ends for display during result
interface HandSnapshot {
  playerCards: number[];
  dealerCards: number[];
  playerValue?: number;
  dealerValue?: number;
  bet: bigint;
}

export function GameBoard() {
  const [betAmount, setBetAmount] = useState('0.00001');
  const [lastHand, setLastHand] = useState<HandSnapshot | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Wallet connection
  const wallet = useRiseWallet();

  // Game state (pass wallet to avoid duplicate hook instances)
  // Note: lastGameResult now includes final hand values from CardDealt WebSocket tracking
  const game = useGameState(wallet);

  // Get result from parsed tx event or contract state
  const currentResult = ((): GameResult => {
    if (game.lastGameResult?.result) return game.lastGameResult.result;
    if (!game.gameData) return null;
    switch (game.gameData.state) {
      case GameState.PlayerWin:
        return 'win';
      case GameState.DealerWin:
        return 'lose';
      case GameState.Push:
        return 'push';
      case GameState.PlayerBlackjack:
        return 'blackjack';
      default:
        return null;
    }
  })();

  // When game ends, store the final cards for display
  // DON'T auto-clear - keep visible until user starts new game
  useEffect(() => {
    if (game.lastGameResult) {
      // Store the final cards and values for display
      setLastHand({
        playerCards: game.lastGameResult.playerCards,
        dealerCards: game.lastGameResult.dealerCards,
        playerValue: game.lastGameResult.playerFinalValue,
        dealerValue: game.lastGameResult.dealerFinalValue,
        bet: 0n,
      });
      // No auto-clear - user will see this until they start a new game
    }
  }, [game.lastGameResult]);

  // Track cooldown - check when in idle state or after game ends
  useEffect(() => {
    if (!wallet.address) return;

    // Check cooldown initially
    const checkCooldown = async () => {
      try {
        const remaining = await ContractService.getCooldownRemaining(
          wallet.address as `0x${string}`
        );
        setCooldownRemaining(remaining);
      } catch (e) {
        console.error('[Cooldown] Error:', e);
      }
    };

    // Initial check
    checkCooldown();

    // Poll every second while there's cooldown remaining OR we just finished a game
    const interval = setInterval(() => {
      checkCooldown();
    }, 1000);

    return () => clearInterval(interval);
  }, [wallet.address, game.lastGameResult]);

  // Use lastResult/lastHand for display if contract has reset
  const gameResult = currentResult;

  // Check if player can take actions
  const canPlay = game.gameData?.state === GameState.PlayerTurn;
  // Can bet when game is idle (including after showing result)
  const canBet =
    (!game.gameData || game.gameData.state === GameState.Idle) && cooldownRemaining === 0;
  const isIdle = canBet && !game.lastGameResult;

  // Can double only on first action (2 cards)
  const canDouble = canPlay && game.gameData?.playerCards.length === 2 && !game.gameData.isDoubled;
  // Can surrender only on first action
  const canSurrender = canPlay && game.gameData?.playerCards.length === 2;

  // Combined error
  const error = wallet.error || game.error;

  // Inline result style - DEGEN UX copy with neon colors
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header - responsive */}
      <header className="p-2 sm:p-4 border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent whitespace-nowrap">
            ♠️ RiseJack
          </h1>
          <WalletConnect
            account={wallet.address}
            isConnected={wallet.isConnected}
            isConnecting={wallet.isConnecting}
            hasSessionKey={wallet.hasSessionKey}
            sessionExpiry={wallet.sessionExpiry}
            error={wallet.error}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
            onCreateSession={wallet.createSessionKey}
            onRevokeSession={wallet.revokeSessionKey}
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-2 sm:p-4 py-4 sm:py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!wallet.isConnected ? (
          /* Not Connected - Welcome Screen */
          <div className="text-center py-20">
            <div className="text-8xl mb-8 opacity-80">🃏</div>
            <h2 className="text-4xl font-bold text-white mb-4">Welcome to RiseJack</h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto text-lg">
              On-chain Blackjack with instant transactions. Connect your Rise Wallet to start
              playing.
            </p>

            {/* Features */}
            <div className="flex justify-center gap-6 mt-12">
              <div className="text-center">
                <div className="text-3xl mb-2">⚡</div>
                <div className="text-sm text-slate-400">10ms Blocks</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🔑</div>
                <div className="text-sm text-slate-400">Session Keys</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🚀</div>
                <div className="text-sm text-slate-400">No Popups</div>
              </div>
            </div>

            {/* Big Connect Button */}
            <button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="mt-12 px-10 py-4 rounded-2xl font-bold text-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 shadow-2xl shadow-purple-500/30"
            >
              {wallet.isConnecting ? '⏳ Connecting...' : '⚡ Connect Rise Wallet'}
            </button>
          </div>
        ) : (
          /* Game Area */
          <div className="space-y-4 sm:space-y-6 md:space-y-8">
            {/* Casino Table - Realistic felt with psychological elements */}
            <div
              className={`casino-table ${gameResult === 'blackjack' ? 'blackjack-glow' : ''} ${gameResult === 'lose' ? 'lose-shake' : ''} ${gameResult === 'lose' && game.playerValue?.value && game.playerValue.value > 21 ? 'bust' : ''}`}
            >
              {/* Win celebration overlay - DEGEN confetti effect */}
              {(gameResult === 'win' || gameResult === 'blackjack') && (
                <>
                  <div className="win-flash" />
                  <div className="win-celebration" />
                </>
              )}

              {/* Loss flash overlay - subtle red */}
              {gameResult === 'lose' && <div className="lose-flash" />}

              {/* Card Deck - LEFT side */}
              <CardDeck
                cardsDealt={
                  (game.gameData?.playerCards?.length ?? 0) +
                  (game.gameData?.dealerCards?.length ?? 0)
                }
              />

              {/* Play Area - responsive padding */}
              <div className="relative z-10 px-2 sm:px-8 md:px-28 py-4 sm:py-6 md:py-10">
                {/* Dealer Zone */}
                <div className="dealer-zone">
                  <div className="zone-label">Dealer</div>
                  <div className="zone-row">
                    {/* Spacer to balance the value on right */}
                    <div className="zone-spacer" />
                    <div className="play-zone">
                      {game.gameData?.dealerCards?.length || lastHand?.dealerCards?.length ? (
                        <Hand
                          cards={game.gameData?.dealerCards || lastHand?.dealerCards || []}
                          value={game.dealerValue ?? lastHand?.dealerValue ?? undefined}
                          isDealer
                          hideSecond={canPlay && !gameResult}
                          result={gameResult === 'lose' ? 'win' : null}
                          hideValue
                        />
                      ) : (
                        <span className="play-zone-empty">Deal to start</span>
                      )}
                    </div>
                    {/* Value display */}
                    <HandValue
                      value={
                        game.gameData?.dealerCards?.length || lastHand?.dealerCards?.length
                          ? (game.dealerValue ?? lastHand?.dealerValue ?? undefined)
                          : undefined
                      }
                      cardCount={(game.gameData?.dealerCards || lastHand?.dealerCards || []).length}
                    />
                  </div>
                </div>

                {/* Player Zone */}
                <div className="player-zone">
                  <div className="zone-row">
                    {/* Spacer to balance the value on right */}
                    <div className="zone-spacer" />
                    <div className="play-zone">
                      {game.gameData?.playerCards?.length || lastHand?.playerCards?.length ? (
                        <Hand
                          cards={game.gameData?.playerCards || lastHand?.playerCards || []}
                          value={game.playerValue?.value ?? lastHand?.playerValue}
                          isSoft={game.playerValue?.isSoft}
                          result={gameResult}
                          hideValue
                        />
                      ) : (
                        <span className="play-zone-empty">Your cards</span>
                      )}
                    </div>
                    {/* Value display */}
                    <HandValue
                      value={
                        game.gameData?.playerCards?.length || lastHand?.playerCards?.length
                          ? (game.playerValue?.value ?? lastHand?.playerValue)
                          : undefined
                      }
                      isSoft={game.playerValue?.isSoft}
                      cardCount={(game.gameData?.playerCards || lastHand?.playerCards || []).length}
                    />
                  </div>
                  <div className="zone-label">Your Hand</div>
                </div>

                {/* Bet display - right side on desktop, between values on mobile */}
                {game.gameData && game.gameData.bet > 0n && (
                  <div className="bet-display-side">
                    <span className="bet-label">BET</span>
                    <span className="bet-value">
                      {game.formatBet(game.gameData.bet)} ETH
                      {game.gameData.isDoubled && ' ×2'}
                    </span>
                  </div>
                )}

                {/* INLINE RESULT BANNER - appears with elastic bounce animation */}
                {gameResult && getResultStyle(gameResult) && (
                  <div
                    className={`result-banner ${getResultStyle(gameResult)?.bg} ${getResultStyle(gameResult)?.text} animate-result-bounce`}
                  >
                    <span className="result-emoji">{getResultStyle(gameResult)?.emoji}</span>
                    <span className="result-message">{getResultStyle(gameResult)?.message}</span>
                    {lastHand && (
                      <span className="result-values">
                        {lastHand.playerValue} vs {lastHand.dealerValue}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Blackjack payout text */}
              <div className="payout-text">Blackjack Pays 3 to 2</div>
            </div>

            {/* Controls - responsive */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-slate-700">
              {isIdle || gameResult ? (
                /* Betting UI */
                <div className="space-y-3 sm:space-y-4">
                  {/* Cooldown indicator */}
                  {cooldownRemaining > 0 && (
                    <div className="text-center py-3 bg-yellow-900/30 border border-yellow-500/30 rounded-lg">
                      <span className="text-yellow-400">⏳ Cooldown: </span>
                      <span className="font-mono font-bold text-yellow-300">
                        {cooldownRemaining}s
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount((e.target as HTMLInputElement).value)}
                      min={game.formatBet(game.betLimits.min)}
                      max={game.formatBet(game.betLimits.max)}
                      step="0.00001"
                      className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg font-mono focus:border-purple-500 focus:outline-none"
                      placeholder="Bet amount"
                    />
                    <span className="text-slate-400">ETH</span>
                  </div>

                  {/* Quick bet buttons */}
                  <div className="flex gap-2">
                    {['0.00001', '0.00005', '0.0001', '0.0005'].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setBetAmount(amount)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          betAmount === amount
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      // Clear previous game display before new bet
                      setLastHand(null);
                      game.clearLastResult();
                      game.placeBet(betAmount);
                    }}
                    disabled={game.isLoading || !canBet}
                    className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
                  >
                    {game.isLoading
                      ? '⏳ Placing Bet...'
                      : cooldownRemaining > 0
                        ? `⏳ Wait ${cooldownRemaining}s`
                        : `Deal Cards - ${betAmount} ETH`}
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    Min: {game.formatBet(game.betLimits.min)} ETH • Max:{' '}
                    {game.formatBet(game.betLimits.max)} ETH
                  </p>
                </div>
              ) : (
                /* Action Buttons */
                <ActionButtons
                  onHit={game.hit}
                  onStand={game.stand}
                  onDouble={game.double}
                  onSurrender={game.surrender}
                  canDouble={canDouble}
                  canSurrender={canSurrender}
                  isLoading={game.isLoading}
                />
              )}
            </div>

            {/* Session Key Hint */}
            {!wallet.hasSessionKey && wallet.isConnected && (
              <div className="text-center text-sm text-purple-400 bg-purple-900/20 rounded-lg py-3 border border-purple-500/20">
                💡 Enable <strong>Fast Mode</strong> above for instant, popup-free gameplay!
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add CSS animation */}
      <style>
        {' '}
        {`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bounce-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-out;
        }
      `}
      </style>
    </div>
  );
}
