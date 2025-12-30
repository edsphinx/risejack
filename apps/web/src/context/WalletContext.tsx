/**
 * WalletContext - Global wallet session state for RISECASINO
 *
 * Provides wallet connection, session key, and balance state
 * to all components in the app without redundant hook calls.
 */

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { useRiseWallet, type UseRiseWalletReturn } from '@/hooks/useRiseWallet';

// Create context with undefined default (will be provided by WalletProvider)
const WalletContext = createContext<UseRiseWalletReturn | undefined>(undefined);

/**
 * WalletProvider - Wrap your app with this to provide global wallet state
 */
export function WalletProvider({ children }: { children: preact.ComponentChildren }) {
  const wallet = useRiseWallet();

  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

/**
 * useWallet - Consume global wallet state
 * Must be used within WalletProvider
 */
export function useWallet(): UseRiseWalletReturn {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
