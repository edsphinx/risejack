# Pending Features & TODO

This document tracks features that are planned but not yet implemented.

---

## 🔴 High Priority

### Merkle Drop for Referral Earnings

**Status**: Pending  
**Depends on**: Go Indexer (✅ Complete), MerkleDrop.sol (❌ Not deployed)

**Description**: Monthly airdrop system for referral earnings.

**Components needed**:

1. **Go Merkle Generator** (`apps/indexer/merkle/`)
   - Query all unclaimed `referral_earnings` from DB
   - Generate Merkle tree with (address, totalAmount) leaves
   - Output: Merkle root + proofs JSON file

2. **MerkleDrop.sol** (`packages/contracts/src/MerkleDrop.sol`)
   - Admin sets new Merkle root monthly
   - Users call `claim(amount, proof)` to receive ETH
   - Tracks claimed status to prevent double-claims

3. **Go Scheduler**
   - Runs on random day between 1st-7th of each month
   - Generates Merkle tree
   - Calls `setMerkleRoot(root)` on contract
   - Marks earnings as `claimed=true` in DB

4. **API Endpoint**
   - `GET /api/referrals/:wallet/proof` - Returns user's Merkle proof

5. **Frontend UI**
   - "Claim Rewards" button in referrals dashboard
   - Shows pending vs claimed amounts

**Estimated effort**: 2-3 days

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
