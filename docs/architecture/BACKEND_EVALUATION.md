# Backend & Growth Architecture Definition

## Architecture Decision: "Speed Demon Stack"

To match Rise Chain 10ms block times, we prioritize low latency and high throughput above all.

### 1. The Stack

- **Frontend**: **Preact** (via Vite).
  - _Why_: Sub-millisecond render updates, <50KB bundle. Essential for 10ms feedback loops.
- **Data API**: **Hono** (on Vercel Edge).
  - _Why_: Instant cold starts (<50ms). Serves read-only data (Leaderboards, User Stats) to frontend via cached JSON.
- **Indexer**: **Go** (on dedicated VPS).
  - _Why_: Manages persistent WebSocket connections to Rise Chain. Processes events and writes to DB with zero overhead.
- **Database**: **Supabase** (PostgreSQL).
  - _Why_: Shared Source of Truth. Indexer writes, API reads.

---

## 2. Growth System Design (Scalable & Secure)

### A. Viral Referral Engine (The "Ponzi-lite" Loop)

_Objective: Incentivize users to bring whales._

1. **On-Chain Registry**:
   - `ReferralRegistry.sol`: Maps `User -> Referrer`.
   - **Immutable**: Once set, the link is permanent (lifetime value).
2. **Indexer Role (Go)**:
   - Listens for `GamePayout(winner, amount)`.
   - Calculates 10% of House Edge (e.g., 1% of total bet).
   - **Accumulates** pending rewards in SQL (off-chain calculation, claim on-chain or off-chain).
   - _Optimization_: To save gas, rewards can be batched-claimed via Merkle Drop or a simple centralized "Claim" signature if we want to subsidize gas.
3. **Hono API**:
   - `GET /api/referrals/stats`: Returns "Total Earned", "Invited Count".

### B. High-Frequency Leaderboards

_Objective: Social proof and competition._

1. **Indexer Role (Go)**:
   - Ingests every `GameEnded`.
   - Updates Real-time Redis/Postgres Stats:
     - `DailyVolume:{user}`
     - `BiggestWin:{txHash}`
2. **Hono API**:
   - `GET /api/leaderboard/daily`: Returns top 50 strictly cached (10s TTL).
   - _Security_: Read-only, no DDoS risk to chain.

---

## 3. Implementation Steps

1. **Initialize Go Workspace**: Create `apps/indexer` with `go.mod`.
2. **Define DB Schema**: Users, GameHistory, Referrals.
3. **Indexer Logic**: Connect to Rise Testnet WS, decode logs.
