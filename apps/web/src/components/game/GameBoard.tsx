import { useState } from 'preact/hooks';
import { useRiseWallet } from '../../hooks/useRiseWallet';
import { useGameState } from '../../hooks/useGameState';
import { WalletConnect } from '../wallet/WalletConnect';
import { Hand } from './Hand';
import { ActionButtons } from './ActionButtons';
import { GameState, type GameResult } from '@risejack/shared';

export function GameBoard() {
  const [betAmount, setBetAmount] = useState('0.001');

  // Wallet connection
  const wallet = useRiseWallet();

  // Game state (only active when connected)
  const game = useGameState(wallet.address);

  // Determine game result
  const getGameResult = (): GameResult => {
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
  };

  // Check if player can take actions
  const canPlay = game.gameData?.state === GameState.PlayerTurn;
  const isIdle = !game.gameData || game.gameData.state === GameState.Idle;
  const gameResult = getGameResult();

  // Can double only on first action (2 cards)
  const canDouble = canPlay && game.gameData?.playerCards.length === 2 && !game.gameData.isDoubled;
  // Can surrender only on first action
  const canSurrender = canPlay && game.gameData?.playerCards.length === 2;

  // Combined error
  const error = wallet.error || game.error;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="p-4 border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
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
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8">
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
          <div className="space-y-8">
            {/* Game Table */}
            <div className="bg-gradient-to-b from-green-800 to-green-900 rounded-2xl p-8 border-8 border-amber-900 shadow-2xl">
              {/* Dealer Hand */}
              <div className="mb-12">
                {game.gameData && game.gameData.dealerCards.length > 0 ? (
                  <Hand
                    cards={game.gameData.dealerCards}
                    value={game.dealerValue ?? undefined}
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
                {game.gameData && game.gameData.playerCards.length > 0 ? (
                  <Hand
                    cards={game.gameData.playerCards}
                    value={game.playerValue?.value}
                    isSoft={game.playerValue?.isSoft}
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
                      ? 'bg-green-500/20 text-green-400'
                      : gameResult === 'lose'
                        ? 'bg-red-500/20 text-red-400'
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
              {game.gameData && game.gameData.bet > 0n && (
                <div className="text-center text-white/60 mb-4">
                  Current Bet:{' '}
                  <span className="text-white font-bold">
                    {game.formatBet(game.gameData.bet)} ETH
                  </span>
                  {game.gameData.isDoubled && (
                    <span className="text-yellow-400 ml-2">(Doubled)</span>
                  )}
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
                      min={game.formatBet(game.betLimits.min)}
                      max={game.formatBet(game.betLimits.max)}
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
                    onClick={() => game.placeBet(betAmount)}
                    disabled={game.isLoading}
                    className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-50 shadow-lg shadow-purple-500/25"
                  >
                    {game.isLoading ? '⏳ Placing Bet...' : `Deal Cards - ${betAmount} ETH`}
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
    </div>
  );
}
