# RISECASINO 🎰

**The first decentralized casino on Rise Chain with 10ms instant finality.**

RISECASINO leverages Rise Chain's Parallel EVM to deliver a gaming experience indistinguishable from Web2, but with full on-chain transparency, provable fairness, and sustainable tokenomics.

## 🚀 Vision

We are building a complete "GambleFi" ecosystem:

- **Instant Games**: Blackjack (live), Roulette, Slots.
- **CHIP Token**: Native currency for all games.
- **DeFi Integration**: ETH/CHIP AMM and Staking for real yield.
- **User Experience**: Session keys = No wallet popups during gameplay.

---

## 📚 Documentation

Detailed documentation is available in the `docs/` directory:

- **[Whitepaper](docs/whitepaper/WHITEPAPER.md)**: Vision, roadmap, and tokenomics overview.
- **[Tokenomics](docs/tokenomics/CHIP_TOKEN.md)**: CHIP token design and economic flow.
- **[Staking Model](docs/tokenomics/STAKING_MODEL.md)**: Real yield mechanics (House Edge sharing).
- **[Revenue Model](docs/business/REVENUE_MODEL.md)**: Financial projections and sustainability.
- **[Smart Contracts](docs/architecture/SMART_CONTRACTS.md)**: Technical architecture and security strategy.
- **[Strategic Analysis](docs/business/STRATEGIC_ANALYSIS.md)**: Risk assessment and licensing.

---

## 🏗 Architecture

### Smart Contracts (`/packages/contracts`)

- **RiseJack.sol**: Core Blackjack engine with VRF integration.
- **CHIPToken.sol** _(Planned)_: ERC-20 gaming currency ($CHIP). The lifeblood of the casino.
- **RiseCasinoSwap.sol** _(Planned)_: Native DEX for instant ETH ↔ CHIP swaps.
- **RiseCasinoStaking.sol** _(Planned)_: House Edge sharing vault (Stake CHIP, Earn ETH).

### Frontend (`/apps/web`)

- **Framework**: Vite + Preact + TypeScript.
- **Routing**: `wouter` for lightweight routing.
- **Design**: Custom CSS + glassmorphism UI.
- **Wallet**: `rise-wallet` SDK with session key support.

---

## 🛠 Setup & Development

### Prerequisites

- Node.js v18+
- Bun (recommended package manager)
- Foundry (for contracts)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun dev
```

### Contract Deployment

```bash
cd packages/contracts
forge build
forge test
```

---

## 📜 License

This project is licensed under the **Business Source License 1.1 (BSL)**.

- **Status**: Source Available.
- **Commercial Use**: Restricted until 2028-04-01.
- **Change License**: MIT (after 2 years).
- **Permitted Use**: You may view, fork, and test the code for personal, educational, or audit purposes. You may NOT run a competing commercial interface or contract deployment without permission.

See `LICENSE` for details.
