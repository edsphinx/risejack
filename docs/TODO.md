# Pending Features & TODO

This document tracks features that are planned but not yet implemented.

---

## 🔴 High Priority

### Merkle Drop for Referral Earnings

**Status**: Pending  
**Depends on**: Go Indexer (✅ Complete), MerkleDistributor.sol (❌ Not deployed), CHIP Token (❌ Not deployed)

**Description**: Monthly airdrop system for referral earnings, paid in CHIP token.

**Base Contract**: [Uniswap/merkle-distributor](https://github.com/Uniswap/merkle-distributor) (battle-tested, $1B+ distributed)

**Components needed**:

1. **CHIP Token** (`packages/contracts/src/CHIPToken.sol`)
   - ERC20 token for Rise Casino ecosystem
   - Used for referral rewards, staking, governance
   - Initial supply minted to treasury

2. **MerkleDistributor.sol** (Fork from Uniswap)
   - Admin sets new Merkle root monthly
   - Users call `claim(index, account, amount, proof)` to receive CHIP
   - Tracks claimed status to prevent double-claims
   - **No modifications needed** - use as-is for ERC20

3. **Go Merkle Generator** (`apps/indexer/merkle/`)
   - Query all unclaimed `referral_earnings` from DB
   - Convert ETH value to CHIP equivalent (use oracle or fixed rate)
   - Generate Merkle tree with (index, address, amount) leaves
   - Output: Merkle root + proofs JSON file

4. **Go Scheduler**
   - Runs on random day between 1st-7th of each month
   - Generates Merkle tree
   - Admin reviews and deploys new MerkleDistributor (or updates root)
   - Marks earnings as `claimed=true` in DB

5. **API Endpoint**
   - `GET /api/referrals/:wallet/proof` - Returns user's Merkle proof for current epoch

6. **Frontend UI**
   - "Claim CHIP Rewards" button in referrals dashboard
   - Shows pending vs claimed amounts in CHIP

**CHIP Token Economics**:

- Referral rewards: 10% of house edge equivalent in CHIP
- Conversion rate: Set by governance or fixed at launch
- Utility: Staking, fee discounts, VIP access

**Estimated effort**: 3-4 days (includes CHIP token deploy)

---

## 🟡 Medium Priority

### Tier 2 Referral Earnings

**Status**: TODO in `apps/indexer/main.go:377`

**Description**: Referrer's referrer gets 2% of house edge.

```
A invites B, B invites C
When C plays:
  - B earns 10% of house edge (Tier 1) ✅ Implemented
  - A earns 2% of house edge (Tier 2) ⏳ TODO
```

---

### JWT Authentication

**Status**: Planned

**Description**: Secure API endpoints with wallet-signed JWT tokens.

- JWT secret on backend only
- 7-day expiration
- Re-auth via wallet signature on 401

---

## 🟢 Low Priority

### User Profile Page

**Status**: Not started

- Display name, avatar
- XP, level, VIP tier
- Game statistics

### Advanced XP System

**Status**: Partial

- ✅ Base XP per game
- ✅ Bonus for win/blackjack/push
- ⏳ Streak bonuses
- ⏳ Daily challenges

---

## ✅ Recently Completed

| Feature                        | Date       | Notes                                   |
| ------------------------------ | ---------- | --------------------------------------- |
| Leaderboard UI                 | 2024-12-31 | XP, Volume, Wins, PnL metrics           |
| Event Logging API              | 2024-12-31 | POST /events with frontend integration  |
| XP Bonus System                | 2024-12-31 | Go Indexer awards bonus XP per outcome  |
| Referral Earnings Accumulation | 2024-12-31 | Go Indexer stores in DB for Merkle Drop |
