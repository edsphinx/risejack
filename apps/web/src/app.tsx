import { WalletProvider } from './providers/WalletProvider';
import { GameBoard } from './components/game/GameBoard';

export function App() {
  return (
    <WalletProvider>
      <GameBoard />
    </WalletProvider>
  );
}
