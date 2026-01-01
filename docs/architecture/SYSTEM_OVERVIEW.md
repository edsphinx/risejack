# System Overview

## Architecture Diagram

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

## Core Components

| Component         | Responsibility                                               |
| ----------------- | ------------------------------------------------------------ |
| Frontend          | User interface, wallet integration, game state visualization |
| Backend API       | Game statistics, leaderboards, off-chain data aggregation    |
| Smart Contract    | Game logic, fund custody, payout execution                   |
| Rise Wallet       | Session key management, gasless transactions                 |
| Randomness Oracle | Provably fair card distribution                              |

## Transaction Flow

1. Player approves session key (one-time popup)
2. Session key signs game actions locally (no popups)
3. Signed transactions submit to Rise Chain
4. Contract executes game logic and payouts
5. Frontend updates via WebSocket events

## VRF Timeout Handling

The system includes robust handling for VRF delays:

| Time Elapsed | UI State           | Available Actions                 |
| ------------ | ------------------ | --------------------------------- |
| 0-60s        | "Dealing cards..." | Waiting spinner                   |
| 60s-5min     | "VRF Delayed"      | Retry option, countdown to cancel |
| >5min        | "Game Stuck"       | Cancel & Full Refund button       |

Players are never stuck - after 5 minutes they can cancel any pending game and receive a full refund.

## Technical Stack

### Frontend

| Technology     | Purpose           | Bundle Impact              |
| -------------- | ----------------- | -------------------------- |
| Preact         | UI Framework      | 3KB (vs React's 40KB)      |
| Vite           | Build Tool        | N/A (dev only)             |
| TailwindCSS    | Styling           | Compile-time, zero runtime |
| CSS Animations | Motion            | 0KB additional             |
| Viem           | Blockchain Client | ~15KB (tree-shaken)        |

### Backend

| Technology | Purpose                |
| ---------- | ---------------------- |
| Bun        | JavaScript Runtime     |
| Hono       | HTTP Framework (~12KB) |
| TypeScript | Type Safety            |

### Blockchain

| Technology      | Purpose                       |
| --------------- | ----------------------------- |
| Rise Chain      | L2 with 10ms blocks, 100K TPS |
| Rise Wallet SDK | Session keys, gasless UX      |
| Foundry         | Smart contract development    |
| Solidity 0.8.28 | Contract language             |

### Build Infrastructure

| Tool           | Purpose                         |
| -------------- | ------------------------------- |
| Bun Workspaces | Monorepo package management     |
| Turborepo      | Build orchestration and caching |
