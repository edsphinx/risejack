import { Chains } from 'rise-wallet';
import { riseWallet } from 'rise-wallet/wagmi';
import { createClient, http } from 'viem';
import { createConfig } from 'wagmi';

// Export the Rise Wallet connector instance for session key access
export const riseWalletConnector = riseWallet();

// Rise Testnet chain config from rise-wallet
export const riseTestnet = Chains.riseTestnet;

// Wagmi config
export const wagmiConfig = createConfig({
  chains: [riseTestnet],
  connectors: [riseWalletConnector],
  client({ chain }) {
    return createClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });
  },
});

// Declare wagmi module augmentation for type safety
declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
