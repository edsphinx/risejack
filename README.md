# Rise Blackjack

**Sub-second on-chain Blackjack powered by Rise Chain's 10ms block times**

Rise Blackjack is a fully on-chain casino game that leverages Rise Chain's ultra-fast block production to deliver a seamless, Web2-like gaming experience while maintaining full transparency and provable fairness.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technical Stack](#technical-stack)
- [Security Model](#security-model)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Smart Contracts](#smart-contracts)
- [Performance Targets](#performance-targets)
- [License](#license)

---

## Architecture Overview

```
                                    Rise Chain (10ms blocks)
                                            |
    +-------------------+          +--------+--------+
    |                   |          |                 |
    |   Frontend        |  <--->   |   Blackjack     |
    |   (Preact + Vite) |          |   Contract      |
    |                   |          |                 |
    +-------------------+          +-----------------+
            |                              |
            v                              v
    +-------------------+          +-----------------+
    |   Rise Wallet     |          |   Randomness    |
    |   Session Keys    |          |   Oracle        |
    +-------------------+          +-----------------+
```

### Core Components

| Component | Responsibility |
|-----------|----------------|
| Frontend | User interface, wallet integration, game state visualization |
| Backend API | Game statistics, leaderboards, off-chain data aggregation |
| Smart Contract | Game logic, fund custody, payout execution |
| Rise Wallet | Session key management, gasless transactions |
| Randomness Oracle | Provably fair card distribution |

### Transaction Flow

1. Player approves session key (one-time popup)
2. Session key signs game actions locally (no popups)
3. Signed transactions submit to Rise Chain
4. Contract executes game logic and payouts
5. Frontend updates via WebSocket events

---

## Technical Stack

### Frontend

| Technology | Purpose | Bundle Impact |
|------------|---------|---------------|
| Preact | UI Framework | 3KB (vs React's 40KB) |
| Vite | Build Tool | N/A (dev only) |
| TailwindCSS | Styling | Compile-time, zero runtime |
| CSS Animations | Motion | 0KB additional |
| Viem | Blockchain Client | ~15KB (tree-shaken) |

### Backend

| Technology | Purpose |
|------------|---------|
| Bun | JavaScript Runtime |
| Hono | HTTP Framework (~12KB) |
| TypeScript | Type Safety |

### Blockchain

| Technology | Purpose |
|------------|---------|
| Rise Chain | L2 with 10ms blocks, 100K TPS |
| Rise Wallet SDK | Session keys, gasless UX |
| Foundry | Smart contract development |
| Solidity 0.8.28 | Contract language |

### Build Infrastructure

| Tool | Purpose |
|------|---------|
| Bun Workspaces | Monorepo package management |
| Turborepo | Build orchestration and caching |

---

## Security Model

### Smart Contract Security

| Measure | Implementation |
|---------|----------------|
| Commit-Reveal Randomness | Prevents front-running and manipulation of card draws |
| State Machine Enforcement | Each game action validated against current state |
| Reentrancy Protection | State changes before external calls |
| Bet Limits | Configurable min/max bet amounts |
| Access Control | Admin functions protected (to be implemented with OpenZeppelin) |

### Session Key Security

| Measure | Implementation |
|---------|----------------|
| P256 Cryptography | WebAuthn-compatible elliptic curve signing |
| Time-Bounded Keys | Session keys expire after configured duration (default: 7 days) |
| Permission Scoping | Keys can only call whitelisted contract functions |
| Spend Limits | Configurable maximum spend per time period |
| Local Key Storage | Private keys never leave the client device |

### Permitted Contract Calls

Session keys are restricted to the following functions only:

- `placeBet(bytes32)` - Start a new game
- `hit()` - Request another card
- `stand()` - End player turn
- `double()` - Double down
- `split()` - Split pairs (when applicable)
- `surrender()` - Forfeit half the bet

### Randomness Guarantees

The commit-reveal scheme ensures:

1. **Unpredictability**: House commits to randomness before player acts
2. **Unbiasability**: Neither party can influence the outcome after commitment
3. **Verifiability**: All randomness inputs are on-chain and auditable

---

## Project Structure

```
risejack/
├── apps/
│   ├── web/                    # Frontend Application
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── hooks/          # Custom Preact hooks
│   │   │   ├── lib/            # Utilities and helpers
│   │   │   └── styles/         # CSS and animations
│   │   ├── vite.config.ts      # Build configuration
│   │   └── tailwind.config.js  # Design system
│   │
│   └── api/                    # Backend API
│       └── src/
│           ├── routes/         # HTTP endpoints
│           └── services/       # Business logic
│
├── packages/
│   ├── contracts/              # Smart Contracts
│   │   ├── src/                # Solidity sources
│   │   ├── test/               # Foundry tests
│   │   ├── script/             # Deployment scripts
│   │   └── foundry.toml        # Foundry configuration
│   │
│   └── shared/                 # Shared Code
│       └── src/
│           ├── types/          # TypeScript interfaces
│           ├── abi/            # Contract ABIs
│           └── utils/          # Common utilities
│
├── turbo.json                  # Build pipeline
├── package.json                # Workspace configuration
└── tsconfig.json               # Base TypeScript config
```

---

## Getting Started

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

## Development

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

### Type Checking

```bash
# All workspaces
bun run typecheck

# Individual
cd apps/web && bun run typecheck
cd apps/api && bun run typecheck
```

---

## Smart Contracts

### Build

```bash
cd packages/contracts
forge build
```

### Test

```bash
# Run all tests
forge test

# With gas report
forge test --gas-report

# Verbose output
forge test -vvv
```

### Deploy

```bash
# Local node
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Rise Testnet
forge script script/Deploy.s.sol --rpc-url $RISE_RPC_URL --broadcast --verify
```

### Contract Interface

| Function | Description | State Requirement |
|----------|-------------|-------------------|
| `placeBet(bytes32)` | Start new game with commit hash | Idle |
| `hit()` | Request another card | PlayerTurn |
| `stand()` | End turn, trigger dealer play | PlayerTurn |
| `double()` | Double bet, take one card | PlayerTurn |
| `surrender()` | Forfeit half bet | PlayerTurn |
| `getGameState(address)` | Read current game state | Any |
| `calculateHandValue(uint8[])` | Calculate hand total | Pure |

---

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Bundle Size (gzip) | < 60KB | Fast initial load, mobile-friendly |
| First Contentful Paint | < 500ms | Immediate visual feedback |
| Time to Interactive | < 800ms | Ready for user input |
| Game Action Latency | < 500ms | Session keys + Rise Chain speed |
| Animation Frame Rate | 60fps | Smooth visual experience |

### Bundle Breakdown (Target)

| Component | Size |
|-----------|------|
| Preact | 3KB |
| Viem (tree-shaken) | 15KB |
| Rise Wallet SDK | 10KB |
| ox (P256) | 8KB |
| Application Code | 6KB |
| **Total** | **~42KB** |

---

## Deployment

### Vercel (Frontend Only)

The frontend is designed for static deployment on Vercel. The game logic runs entirely on-chain, so no backend is required for core functionality.

```bash
# From repository root
cd apps/web

# Option 1: Vercel CLI
vercel

# Option 2: Connect repository in Vercel Dashboard
# Root Directory: apps/web
# Framework: Vite
# Build Command: cd ../.. && bun run build --filter=@risejack/web
# Output Directory: dist
```

**Environment Variables** (set in Vercel Dashboard):

| Variable | Description |
|----------|-------------|
| `VITE_CONTRACT_ADDRESS` | Deployed Blackjack contract address |
| `VITE_RPC_URL` | Rise Chain RPC endpoint |
| `VITE_WSS_URL` | Rise Chain WebSocket endpoint |

### Backend (Optional)

The backend API (`apps/api`) is available for future features like:
- Off-chain leaderboards
- Game history aggregation
- Analytics

If needed, deploy separately to:
- [Railway](https://railway.app) (Bun support)
- [Fly.io](https://fly.io) (Bun support)
- [Render](https://render.com)

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

Built for Rise Chain | Powered by Bun
