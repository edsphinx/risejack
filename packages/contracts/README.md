# RiseJack Smart Contracts

On-chain Blackjack game with provably fair randomness via Rise VRF.

## Deployed Contracts

| Network | Contract | Address | Verified |
|---------|----------|---------|----------|
| Rise Testnet | RiseJack | [`0x8a0AaDE6ebDaEF9993084a29a46BD1C93eC6001a`](https://explorer.testnet.riselabs.xyz/address/0x8a0aade6ebdaef9993084a29a46bd1c93ec6001a) | ✅ |

## Features

- **Core Actions**: Hit, Stand, Double Down, Surrender
- **Provably Fair**: Rise VRF for card dealing
- **House Protection**: Daily limits, circuit breaker, exposure tracking
- **Anti-Bot**: Infinite deck prevents card counting

## Quick Start

```bash
# Install dependencies
forge install

# Build
forge build

# Test
forge test

# Deploy to Rise Testnet
source .env
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url https://testnet.riselabs.xyz \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url 'https://explorer.testnet.riselabs.xyz/api/'
```

## Environment Variables

Create a `.env` file:

```
DEPLOYER_PRIVATE_KEY=0x...
RPC_URL=https://testnet.riselabs.xyz
```

## Documentation

- [Production Roadmap](./PRODUCTION_ROADMAP.md)
- [Deployment Changelog](./DEPLOYMENTS.md)
