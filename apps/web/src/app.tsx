export function App() {
    return (
        <div class="min-h-screen bg-gradient-to-br from-casino-felt-dark via-casino-felt to-casino-felt-dark">
            <div class="container mx-auto px-4 py-8">
                {/* Header */}
                <header class="text-center mb-12">
                    <h1 class="font-display text-5xl font-bold text-casino-gold mb-2">
                        🃏 Rise Blackjack
                    </h1>
                    <p class="text-casino-gold-light/70 text-lg">
                        Sub-second on-chain gaming powered by Rise Chain
                    </p>
                </header>

                {/* Game Board Placeholder */}
                <main class="max-w-4xl mx-auto">
                    <div class="bg-casino-felt-light/20 backdrop-blur border-2 border-casino-border rounded-3xl p-8 shadow-2xl">
                        <div class="text-center text-white/80">
                            <div class="text-6xl mb-6">♠️ ♥️ ♣️ ♦️</div>
                            <h2 class="text-2xl font-display font-bold text-casino-gold mb-4">
                                Coming Soon
                            </h2>
                            <p class="text-white/60 max-w-md mx-auto">
                                The fastest on-chain Blackjack experience.
                                Connect your Rise Wallet to play with session keys -
                                no popups, instant actions.
                            </p>

                            {/* Placeholder Button */}
                            <button
                                class="mt-8 px-8 py-4 bg-casino-gold hover:bg-casino-gold-light text-casino-felt-dark font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
                            >
                                Connect Rise Wallet
                            </button>
                        </div>
                    </div>

                    {/* Stats Preview */}
                    <div class="grid grid-cols-3 gap-4 mt-8">
                        <div class="bg-white/5 backdrop-blur rounded-xl p-4 text-center border border-white/10">
                            <div class="text-3xl font-bold text-casino-gold">10ms</div>
                            <div class="text-white/60 text-sm">Block Time</div>
                        </div>
                        <div class="bg-white/5 backdrop-blur rounded-xl p-4 text-center border border-white/10">
                            <div class="text-3xl font-bold text-casino-gold">&lt;500ms</div>
                            <div class="text-white/60 text-sm">Action Speed</div>
                        </div>
                        <div class="bg-white/5 backdrop-blur rounded-xl p-4 text-center border border-white/10">
                            <div class="text-3xl font-bold text-casino-gold">0</div>
                            <div class="text-white/60 text-sm">Popups</div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
