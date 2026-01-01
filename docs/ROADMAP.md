# Rise Casino Roadmap

This roadmap outlines the strategic development plan for Rise Casino, focusing on growth, user retention, and platform maturity.

## 🏁 Phase 1: Foundation (Current Status)

**Goal:** Stable, secure, and mobile-friendly betting platform.

- [x] **Core Game Logic**: RiseJack (Blackjack) smart contracts audited and deployed.
- [x] **VRF Integration**: Verifiable On-Chain Randomness for every hand.
- [x] **Session Keys**: Gasless, popup-free gameplay experience.
- [x] **Mobile Support**: WebAuthn polyfill for seamless mobile wallet connection.
- [x] **Security**: Environment-aware logging, time-bounded sessions.

---

## 🚀 Phase 2: Growth (Q1 2026)

**Goal:** Accelerate user acquisition and viral loops.

### 👥 1. Referral System

**Impact:** Viral Growth  
Implement an on-chain referral system where users earn a percentage of house edge from referred players.

- **On-chain mechanics**: Referral registry contract.
- **Frontend**: Dashboard to copy invite links and view earnings.
- **Incentive**: 10% of house edge share to referrer.
- **Go Indexer**: ✅ Accumulates earnings in `referral_earnings` table.

#### 🎁 Merkle Drop (Pending)

**Monthly airdrop for accumulated referral earnings:**

- Go service generates Merkle tree from pending earnings.
- `MerkleDrop.sol` contract for trustless claims.
- Random day each month to prevent gaming.
- Users claim via proof on frontend.

> **Status**: Earnings accumulation ✅ | Merkle Drop ⏳ Pending

### 🏆 2. Leaderboards

**Impact:** Retention & Social Proof  
Weekly and monthly competitions to drive engagement.

- **Metrics**: Highest Volume, Biggest Win, Most Hands Played.
- **Rewards**: Automated CHIP token airdrops for top 3 players.
- **UI**: Real-time leaderboard in the game lobby.

---

## 💎 Phase 3: Retention & Trust (Q2 2026)

**Goal:** deepen user trust and improve extended play sessions.

### 📜 3. Provably Fair Verification

**Impact:** Trust & Transparency  
Frontend tools to easily verify the VRF output for any past hand.

- **History View**: Detailed log of all user's past games with transaction hashes.
- **Verify Tool**: Input a game ID to see the raw VRF proof and card derivation logic.

### 💱 4. Multi-Currency Support

**Impact:** Accessibility  
Support for major stablecoins and tokens beyond native ETH.

- **Tokens**: USDC, USDT, and partner tokens.
- **Tech**: Uniswap V2/V3 integration for auto-swap or direct betting vault support.

---

## ✨ Phase 4: Polish & Expansion (Q2 2026+)

**Goal:** Premium user experience and game variety.

### 🎨 5. Enhanced Visuals

**Impact:** User Experience

- **Animations**: Deal animations, win celebrations (confetti, neon effects).
- **Sound**: Context-aware sound effects (chips clinking, card dealing, win chimes).

### 🃏 6. New Games

**Impact:** Variety

- **RisePoker**: Video poker on-chain.
- **RiseRoulette**: VRF-powered roulette.

---

## 🛠 Technical Improvements (Ongoing)

- **Gas Optimization**: Continuous refinement of contract gas usage.
- **Indexer**: Subgraph implementation for faster data querying (leaderboards, history).
- **Account Abstraction**: Full EIP-4337 support for social login (Google/Apple).
