import { useState } from 'preact/hooks';
import { useBlackjack, type WalletMode } from '../../hooks/useBlackjack';
import { WalletConnect } from '../wallet/WalletConnect';
import { Hand } from './Hand';
import { ActionButtons } from './ActionButtons';
import { GameState, type GameResult } from '@risejack/shared';

export function GameBoard() {
  const [walletMode, setWalletMode] = useState<WalletMode>('rise');
  const [betAmount, setBetAmount] = useState('0.001');

  const {
    account,
    isConnected,
    gameData,
    playerValue,
    dealerValue,
    betLimits,
    isLoading,
    error,
    hasSessionKey,
    sessionExpiry,
    createSessionKey,
    connect,
    disconnect,
    placeBet,
    hit,
    stand,
    double,
    surrender,
    formatEther,
  } = useBlackjack({ walletMode });

  // Determine game result
  const getGameResult = (): GameResult => {
    if (!gameData) return null;
    switch (gameData.state) {
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
  };

  // Check if player can take actions
  const canPlay = gameData?.state === GameState.PlayerTurn;
  const isIdle = !gameData || gameData.state === GameState.Idle;
  const gameResult = getGameResult();

  // Can double only on first action (2 cards)
  const canDouble = canPlay && gameData?.playerCards.length === 2 && !gameData.isDoubled;
  // Can surrender only on first action
  const canSurrender = canPlay && gameData?.playerCards.length === 2;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="p-4 border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            ♠️ RiseJack
          </h1>
          <WalletConnect
            account={account}
            isConnected={isConnected}
            walletMode={walletMode}
            hasSessionKey={hasSessionKey}
            sessionExpiry={sessionExpiry}
            onConnect={connect}
            onDisconnect={disconnect}
            onCreateSession={createSessionKey}
            onModeChange={setWalletMode}
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {!isConnected ? (
          /* Not Connected */
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🎰</div>
            <h2 className="text-3xl font-bold text-white mb-4">Welcome to RiseJack</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Connect your wallet to play on-chain Blackjack with instant, gasless transactions
              powered by Rise session keys.
            </p>
          </div>
        ) : (
          /* Game Area */
          <div className="space-y-8">
            {/* Game Table */}
            <div className="bg-gradient-to-b from-green-800 to-green-900 rounded-2xl p-8 border-8 border-amber-900 shadow-2xl">
              {/* Dealer Hand */}
              <div className="mb-12">
                {gameData && gameData.dealerCards.length > 0 ? (
                  <Hand
                    cards={gameData.dealerCards}
                    value={dealerValue ?? undefined}
                    isDealer
                    hideSecond={canPlay}
                    result={gameResult === 'lose' ? 'win' : null}
                  />
                ) : (
                  <div className="text-center text-white/40 py-8">Dealer</div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-white/20 my-8" />

              {/* Player Hand */}
              <div className="mb-8">
                {gameData && gameData.playerCards.length > 0 ? (
                  <Hand
                    cards={gameData.playerCards}
                    value={playerValue?.value}
                    isSoft={playerValue?.isSoft}
                    result={gameResult}
                  />
                ) : (
                  <div className="text-center text-white/40 py-8">Your Hand</div>
                )}
              </div>

              {/* Game Result Banner */}
              {gameResult && (
                <div
                  className={`text-center py-4 rounded-lg mb-6 font-bold text-xl ${
                    gameResult === 'win' || gameResult === 'blackjack'
                      ? 'bg-green-500/20 text-green-400 winner'
                      : gameResult === 'lose'
                        ? 'bg-red-500/20 text-red-400 loser'
                        : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {gameResult === 'blackjack' && '🎉 BLACKJACK! '}
                  {gameResult === 'win' && '🎉 YOU WIN! '}
                  {gameResult === 'lose' && '😢 Dealer Wins '}
                  {gameResult === 'push' && '🤝 Push - Bet Returned'}
                </div>
              )}

              {/* Bet Info */}
              {gameData && gameData.bet > 0n && (
                <div className="text-center text-white/60 mb-4">
                  Current Bet:{' '}
                  <span className="text-white font-bold">{formatEther(gameData.bet)} ETH</span>
                  {gameData.isDoubled && <span className="text-yellow-400 ml-2">(Doubled)</span>}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              {isIdle || gameResult ? (
                /* Betting UI */
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount((e.target as HTMLInputElement).value)}
                      min={formatEther(betLimits.min)}
                      max={formatEther(betLimits.max)}
                      step="0.001"
                      className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg font-mono focus:border-purple-500 focus:outline-none"
                      placeholder="Bet amount"
                    />
                    <span className="text-slate-400">ETH</span>
                  </div>

                  {/* Quick bet buttons */}
                  <div className="flex gap-2">
                    {['0.001', '0.005', '0.01', '0.05'].map((amount) => (
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
                    onClick={() => placeBet(betAmount)}
                    disabled={isLoading}
                    className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-50 shadow-lg shadow-purple-500/25"
                  >
                    {isLoading ? 'Placing Bet...' : `Deal Cards - ${betAmount} ETH`}
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    Min: {formatEther(betLimits.min)} ETH • Max: {formatEther(betLimits.max)} ETH
                  </p>
                </div>
              ) : (
                /* Action Buttons */
                <ActionButtons
                  onHit={hit}
                  onStand={stand}
                  onDouble={double}
                  onSurrender={surrender}
                  canDouble={canDouble}
                  canSurrender={canSurrender}
                  isLoading={isLoading}
                />
              )}
            </div>

            {/* Session Key Hint */}
            {walletMode === 'rise' && !hasSessionKey && isConnected && (
              <div className="text-center text-sm text-slate-500">
                💡 Create a session key above for instant, popup-free gameplay!
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
