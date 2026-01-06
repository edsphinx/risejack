# VyreCasino Smart Contracts

On-chain Blackjack game with provably fair randomness via Rise VRF.

## Architecture

| Contract         | Coverage   | Purpose                                  |
| ---------------- | ---------- | ---------------------------------------- |
| VyreCasino.sol   | **95.45%** | Orchestrator - house edge, referrals, XP |
| VyreTreasury.sol | **94.20%** | Secure vault with daily limits           |
| VyreJackCore.sol | **95.79%** | Pure blackjack game logic                |
| VyreJackETH.sol  | Passing    | Standalone ETH blackjack                 |

## Features

- **Core Actions**: Hit, Stand, Double Down, Surrender
- **Provably Fair**: Rise VRF for card dealing
- **House Protection**: Daily limits, circuit breaker, exposure tracking
- **Anti-Bot**: Infinite deck prevents card counting
- **Two-Step Ownership**: Secure admin transfers
- **12 UX Events**: Frontend-optimized event emissions

## Quick Start

```bash
# Install dependencies
forge install

# Build
forge build

# Test (170+ tests)
forge test

# Coverage
forge coverage --match-contract VyreJackCoreTest

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

- [Code Conventions](./CONVENTIONS.md)
- [Production Roadmap](./PRODUCTION_ROADMAP.md)
- [Deployment Changelog](./DEPLOYMENTS.md)
