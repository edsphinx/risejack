export function Swap() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="container mx-auto px-4 py-4">
        <div className="max-w-md mx-auto mt-20 p-8 rounded-2xl bg-gray-900 border border-white/10 text-center">
          <div className="text-6xl mb-6">💱</div>
          <h1 className="text-3xl font-black italic mb-2">AMM SWAP</h1>
          <p className="text-gray-400 mb-8">
            Instant ETH ↔ CHIP swaps coming soon.
            <br />
            Deep liquidity powered by Uniswap V2-style pools.
          </p>
          <div className="inline-block px-4 py-2 bg-purple-900/50 text-purple-300 rounded-lg text-sm font-mono border border-purple-500/30">
            STATUS: DEVELOPMENT
          </div>
        </div>
      </div>
    </div>
  );
}
