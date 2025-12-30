import { Route, Switch } from 'wouter-preact';
import { Home } from './pages/Home';
import { RiseJack } from './pages/RiseJack';
import { Swap } from './pages/Swap';
import { Stake } from './pages/Stake';
import { WalletConnect } from './components/wallet/WalletConnect';
import { Logo } from './components/brand/Logo';
import { useLocation } from 'wouter-preact';
import { WalletProvider, useWallet } from './context/WalletContext';

function Header() {
  const [location, setLocation] = useLocation();
  const isGame = location === '/risejack';

  // Use global wallet context
  const wallet = useWallet();

  return (
    <header className="p-2 sm:p-4 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left Side: Logo + Nav */}
        <div className="flex items-center gap-6">
          <div className="cursor-pointer" onClick={() => setLocation('/')}>
            {/* Logo - responsive adaptation from RiseJack */}
            <div className="sm:hidden">
              <Logo size="compact" variant={isGame ? 'risejack' : 'risecasino'} />
            </div>
            <div className="hidden sm:block">
              <Logo size="full" variant={isGame ? 'risejack' : 'risecasino'} />
            </div>
          </div>

          {/* Navigation - Subtle integration */}
          <nav className="hidden md:flex gap-4 text-xs font-bold text-gray-400 tracking-wider">
            <button
              type="button"
              onClick={() => setLocation('/')}
              className={`cursor-pointer hover:text-purple-400 transition-colors bg-transparent border-none ${location === '/' ? 'text-purple-400' : ''}`}
            >
              LOBBY
            </button>
            <button
              type="button"
              onClick={() => setLocation('/swap')}
              className={`cursor-pointer hover:text-purple-400 transition-colors bg-transparent border-none ${location === '/swap' ? 'text-purple-400' : ''}`}
            >
              SWAP
            </button>
            <button
              type="button"
              onClick={() => setLocation('/stake')}
              className={`cursor-pointer hover:text-purple-400 transition-colors bg-transparent border-none ${location === '/stake' ? 'text-purple-400' : ''}`}
            >
              STAKE
            </button>
          </nav>
        </div>

        {/* Right Side: WalletConnect */}
        <WalletConnect
          account={wallet.address}
          isConnected={wallet.isConnected}
          isConnecting={wallet.isConnecting}
          error={wallet.error}
          onConnect={wallet.connect}
          onDisconnect={wallet.disconnect}
          hasSessionKey={wallet.hasSessionKey}
          sessionExpiry={wallet.sessionExpiry}
          onCreateSession={wallet.createSessionKey}
          onRevokeSession={wallet.revokeSessionKey}
        />
      </div>
    </header>
  );
}

export function App() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 font-sans selection:bg-purple-500/30 text-white">
        <Header />

        <main>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/risejack" component={RiseJack} />
            <Route path="/swap" component={Swap} />
            <Route path="/stake" component={Stake} />

            {/* Fallback to Home */}
            <Route component={Home} />
          </Switch>
        </main>
      </div>
    </WalletProvider>
  );
}
