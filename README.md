# Rise Blackjack

[![Contracts CI](https://github.com/edsphinx/risejack/actions/workflows/contracts.yml/badge.svg)](https://github.com/edsphinx/risejack/actions/workflows/contracts.yml)
[![codecov](https://codecov.io/gh/edsphinx/risejack/branch/main/graph/badge.svg)](https://codecov.io/gh/edsphinx/risejack)
[![License: BSL-1.1](https://img.shields.io/badge/License-BSL--1.1-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-FFDB1C?logo=ethereum)](https://book.getfoundry.sh/)
[![Slither](https://img.shields.io/badge/Slither-Analyzed-green?logo=ethereum)](https://github.com/crytic/slither)

**Sub-second on-chain Blackjack powered by Rise Chain's 10ms block times**

Rise Blackjack is a fully on-chain casino game that leverages Rise Chain's ultra-fast block production to deliver a seamless, Web2-like gaming experience while maintaining full transparency and provable fairness.

---

## ⚡ Powered by Rise Chain

| Technology       | Usage                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| **Shreds**       | Real-time event streaming for live wins ticker and auto-refresh leaderboard |
| **Fast VRF**     | Provably fair random card generation with sub-second response               |
| **Rise Wallet**  | Passkey-based authentication - no seed phrases, instant onboarding          |
| **Session Keys** | Gasless gameplay - players never sign individual transactions               |

### Shreds Integration

The frontend subscribes to on-chain `GameEnded` events via Shreds WebSocket:

- **LiveWinsTicker** - Shows real-time wins across all players
- **LeaderboardPreview** - Auto-refreshes when activity is detected
- **< 100ms latency** from on-chain event to UI update

---

## 📚 Documentation

Detailed documentation is available in the [`docs/`](./docs/README.md) directory:

- 🗺️ **[Roadmap](./docs/ROADMAP.md)** - Feature timeline and milestones
- 🏗️ **[System Architecture](./docs/architecture/SYSTEM_OVERVIEW.md)** - Full system design and stack
- 🔒 **[Security Model](./docs/security/SECURITY_MODEL.md)** - Session keys, VRF, audits
- 🪙 **[Tokenomics](./docs/tokenomics/CHIP_TOKEN.md)** - CHIP token and staking
- ⚖️ **[Legal & Business](./docs/business/REVENUE_MODEL.md)** - Revenue model and risks

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.1 or later
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/edsphinx/risejack.git
cd risejack

# Install all dependencies
bun install

# Initialize Foundry dependencies (first time only)
cd packages/contracts
forge install
cd ../..
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Configure variables:
# - RISE_RPC_URL: Rise Chain RPC endpoint
# - PRIVATE_KEY: Deployer private key (for contract deployment)
# - CONTRACT_ADDRESS: Deployed Blackjack contract address
```

---

## 🛠 Development

### Start All Services

```bash
# Start frontend and backend with Turborepo
bun run dev
```

### Individual Workspaces

```bash
# Frontend (https://localhost:5173)
cd apps/web && bun run dev

# Backend (http://localhost:3000)
cd apps/api && bun run dev
```

### Test Commands

```bash
cd packages/contracts
bun run test:defi         # Unit tests
bun run test:invariant    # Invariant tests
bun run test:fork         # Rise testnet fork
```

See [Security Documentation](./docs/security/SECURITY_MODEL.md) for full testing details.

---

## 📂 Project Structure

```
risejack/
├── apps/
│   ├── web/                    # Frontend Application (Preact + Vite)
│   └── api/                    # Backend API (Hono + Bun)
├── packages/
│   ├── contracts/              # Smart Contracts (Foundry)
│   └── shared/                 # Shared Types & Utils
├── docs/                       # Project Documentation
├── turbo.json                  # Build pipeline
└── package.json                # Workspace configuration
```

---

## 💱 DeFi Integration (Uniswap V2)

The project uses **official Uniswap V2 contracts** deployed in separate repositories:

| Repository                                 | Purpose   | Contracts                       |
| ------------------------------------------ | --------- | ------------------------------- |
| [`risecasinoswap/`](../risecasinoswap)     | AMM Core  | UniswapV2Factory, UniswapV2Pair |
| [`risecasinorouter/`](../risecasinorouter) | Periphery | UniswapV2Router02               |

### Deployed Addresses (Rise Testnet)

```bash
# Check deployment-router-rise_testnet.json for current addresses
cat ../risecasinorouter/deployment-router-rise_testnet.json
```

### CHIP/USDC Swap (1:1 Stablecoin Peg)

- CHIP is designed to trade at ~$1 (pegged to USDC via LP)
- Swaps available via in-app widget
- 0.3% swap fee (standard Uniswap)

---

---

## License

This project is licensed under the **Business Source License 1.1 (BSL)**.

- **Change License**: Apache 2.0 (effective 2028-04-01)
- **Commercial Use**: Restricted until the Change Date

See [LICENSE](./LICENSE) for full details.

---

## Author

Developed by **[@edsphinx](https://github.com/edsphinx)**

Built for Rise Chain | Powered by Bun | Secured by Foundry
