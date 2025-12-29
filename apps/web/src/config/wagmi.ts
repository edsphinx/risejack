import { Chains } from 'rise-wallet';
import { risewallet } from 'rise-wallet/wagmi';
import { createClient, http } from 'viem';
import { createConfig } from 'wagmi';

// Export the Rise Wallet connector instance for session key access
export const riseWalletConnector = risewallet();

// Rise Testnet chain config from rise-wallet
export const riseTestnet = Chains.riseTestnet;

// Wagmi config - matching wallet-demo structure
export const wagmiConfig = createConfig({
  chains: [riseTestnet],
  connectors: [riseWalletConnector],
  transports: {
    [riseTestnet.id]: http('https://testnet.riselabs.xyz'),
  },
});

// Public client for read operations
export const publicClient = createClient({
  chain: riseTestnet,
  transport: http('https://testnet.riselabs.xyz'),
});

// Declare wagmi module augmentation for type safety
declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
