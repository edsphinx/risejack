# RiseJack Smart Contract - Production Roadmap

## Overview

This document tracks the development progress of the RiseJack smart contract from current state to production-ready deployment on Rise Chain mainnet.

**Current Status:** ✅ Phase 1 Testing complete! 45/45 tests passing, 91% line coverage, 100% function coverage
**Target:** Production-ready contract with deployment to Rise mainnet

---

## Audit Analysis Status

Review of findings from security analysis:

| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| A. DoS via failed payouts | HIGH | ✅ RESOLVED | Pull Payment pattern with `_safePayout()` and `pendingWithdrawals` |
| B. Infinite deck model | INFO | ✅ BY DESIGN | Intentionally infinite to prevent card counting attacks |
| C. Gas limit on dynamic arrays | LOW | ✅ ACCEPTED | Statistically improbable; max cards ~11-12 per hand |
| D. VRF seed collisions | LOW | ✅ RESOLVED | Added `playerNonces` to all VRF seeds |

---

## Blackjack Feature Comparison

Comparison against standard casino blackjack rules:

| Feature | Casino Standard | Our Implementation | Status |
|---------|----------------|-------------------|--------|
| **Core Actions** | | | |
| Hit | Request another card | `hit()` | DONE |
| Stand | End turn | `stand()` | DONE |
| Double Down | Double bet, one card only | `double()` | DONE |
| Surrender | Forfeit half bet | `surrender()` | DONE |
| Split | Split pairs into 2 hands | - | FUTURE |
| Insurance | Side bet when dealer shows Ace | - | FUTURE |
| **Payouts** | | | |
| Blackjack | 3:2 (150% profit) | `BLACKJACK_PAYOUT = 150` | DONE |
| Win | 1:1 (100% profit) | `bet * 2` returned | DONE |
| Push | Return bet | `bet` returned | DONE |
| Insurance | 2:1 | - | FUTURE |
| **Dealer Rules** | | | |
| Hit on 16 or less | Automatic | `_shouldDealerHit` | DONE |
| Stand on 17+ | Automatic | `_shouldDealerHit` | DONE |
| Hit on Soft 17 | Varies by casino | Implemented (hits) | DONE |
| **Card Handling** | | | |
| Infinite Deck | N/A | `random % 52` | DONE (BY DESIGN) |
| **House Protection** | | | |
| Daily profit limit | Per player cap | `dailyProfitLimit` | DONE |
| Min reserve auto-pause | Liquidity protection | `minReserve` | DONE |
| Circuit breaker | Anomaly detection | `CIRCUIT_BREAKER_*` | DONE |
| Exposure tracking | Total risk | `totalExposure` | DONE |
| Emergency pause | Manual stop | `pause()` / `unpause()` | DONE |
| House stats | Monitoring | `getHouseStats()` | DONE |
| **Security** | | | |
| Provably fair | Verifiable randomness | Rise VRF | DONE |
| Anti-reentrancy | CEI pattern | Implemented | DONE |
| Failed payout handling | Pull Payment | `pendingWithdrawals` | DONE |

> [!IMPORTANT]
> **Infinite Deck is Intentional**: We use `random % 52` (infinite deck) instead of real card tracking.
> This is a SECURITY FEATURE that prevents card counting with bots/AI.
> Each card is statistically independent, making the game unpredictable.

---

## Phase 1: Testing Infrastructure

**Objective:** Achieve 90%+ test coverage with comprehensive scenarios

### Checkpoints

- [x] **1.1 Core Game Flow Tests**
  - [x] Full game: player wins with higher hand (`test_PlayerWinsFullGame`)
  - [x] Full game: dealer wins with higher hand (`test_DealerWinsFullGame`)
  - [x] Full game: dealer busts (`test_PlayerWinsFullGame` - dealer busts scenario)
  - [x] Full game: push (tie) (`test_PushFullGame`)
  - [x] Multiple hits before stand (`test_Hit`, `test_HitAndBust`)

- [x] **1.2 Edge Case Tests**
  - [x] Player hits to exactly 21 (auto-stand) - handled in `_handlePlayerHit`
  - [x] Multiple aces in hand (soft to hard conversion) (`test_CalculateHandValueWithAceBusted`)
  - [x] Dealer soft 17 hit scenario - implemented in `_shouldDealerHit`
  - [x] Double down winning/losing scenarios (`test_DoubleDown`, `test_DoubleDownMustMatchBet`)
  - [ ] Maximum cards in hand (gas limit test) - edge case, statistically rare

- [x] **1.3 Security Tests**
  - [x] Pending withdrawals flow (`test_WithdrawPendingPayout`)
  - [x] withdraw() function (`test_WithdrawPendingPayout`, `test_WithdrawRevertsIfNoPending`)
  - [x] Admin functions (`test_SetBetLimits`, `test_WithdrawHouseFunds`, `test_SetDailyProfitLimit`, `test_SetMinReserve`)
  - [x] Ownership transfer (`test_TransferOwnership`)
  - [x] Unauthorized access attempts (`test_OnlyVRFCanFulfill`, `test_OnlyOwnerCanPause`, `test_SetBetLimitsOnlyOwner`)

- [x] **1.4 Fuzz Testing**
  - [x] Fuzz bet amounts within limits (`testFuzz_PlaceBet`)
  - [x] Fuzz random card values (`testFuzz_CalculateHandValue`)
  - [x] Fuzz full game flow (`testFuzz_FullGameWithRandomCards`)
  - [x] **Medusa fuzzer** - 112K+ calls, 511 branches, 16 tests passed

- [x] **1.5 Invariant Testing**
  - [x] Contract balance >= sum of pending payouts (`invariant_balanceCoversWithdrawals`)
  - [x] Game state consistency (`invariant_gamesHaveValidTimestamps`)
  - [x] Exposure reasonable (`invariant_exposureReasonable`)
  - [x] 640,000 handler calls with 0 reverts

---

## ~~Phase 2: Real Deck Implementation~~ CANCELLED

> [!NOTE]
> **Decision**: Real deck implementation is CANCELLED.
> Infinite deck is kept as a SECURITY FEATURE to prevent card counting with bots/AI.
> See security documentation in contract header.

---

## Phase 3: Timeout and Cleanup Mechanisms

**Objective:** Handle abandoned games and VRF failures

### Checkpoints

- [x] **3.1 Game Timeout**
  - [x] Add `GAME_TIMEOUT` constant (1 hour)
  - [x] Implement `cancelTimedOutGame()` for timed out games
  - [x] Refund logic for abandoned bets

- [x] **3.2 VRF Request Timeout**
  - [x] Track VRF request timestamps (`VRFRequest.timestamp`)
  - [x] Implement retry mechanism (`retryVRFRequest()`)
  - [x] Handle permanently unfulfilled requests (5 min timeout)

- [x] **3.3 Admin Emergency Functions**
  - [x] `pause()` for emergencies
  - [x] `forceResolveGame()` for stuck games
  - [x] Proper access control on emergency functions

---

## Phase 4: Advanced Features

**Objective:** Production-grade features and optimizations

### Checkpoints

- [ ] **4.1 Split Functionality**
  - [ ] Detect splittable hands (pairs)
  - [ ] Handle multiple hands per player
  - [ ] VRF requests for split hands

- [ ] **4.2 Insurance Betting**
  - [ ] Offer insurance when dealer shows Ace
  - [ ] 2:1 payout logic
  - [ ] Integration with game flow

- [ ] **4.3 Rate Limiting**
  - [ ] Limit VRF requests per player per block
  - [ ] Prevent spam attacks
  - [ ] Cooldown between games

- [ ] **4.4 Gas Optimization**
  - [ ] Optimize storage patterns
  - [ ] Reduce SLOAD/SSTORE operations
  - [ ] Benchmark against target gas costs

---

## Phase 5: Deployment and Monitoring

**Objective:** Safe deployment with monitoring infrastructure

### Checkpoints

- [ ] **5.1 Testnet Deployment**
  - [ ] Deploy to Rise testnet
  - [ ] Verify contract on explorer
  - [ ] End-to-end testing with frontend

- [ ] **5.2 Security Review**
  - [ ] Internal code review
  - [ ] External audit (if budget allows)
  - [ ] Bug bounty program setup

- [ ] **5.3 Mainnet Deployment**
  - [ ] Final parameter configuration
  - [ ] Multi-sig ownership setup
  - [ ] Gradual rollout (low limits initially)

- [ ] **5.4 Monitoring**
  - [ ] Event indexing setup
  - [ ] Alert system for anomalies
  - [ ] Dashboard for game statistics

---

## Current Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Security Fixes | ✅ Complete | 100% |
| House Protection | ✅ Complete | 100% |
| Phase 1: Testing | ✅ Complete | 91% coverage |
| Phase 2: Real Deck | ❌ Cancelled | N/A |
| Phase 3: Timeouts | ✅ Partial | 60% |
| Phase 4: Advanced | Not Started | 0% |
| Phase 5: Deployment | Not Started | 0% |

### Test Coverage Report (45 tests)

| Metric | Coverage |
|--------|----------|
| Lines | 91.23% (281/308) |
| Statements | 90.77% (295/325) |
| Branches | 70.59% (72/102) |
| Functions | 100% (40/40) |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-12-29 | No OpenZeppelin | Avoid overhead; manual implementations sufficient |
| 2024-12-29 | Pull Payment pattern | Prevent DoS from reverting recipients |
| 2024-12-29 | Player nonces in VRF seed | Prevent theoretical collisions on fast L2 |
| 2024-12-29 | **Infinite deck permanent** | Prevents card counting with bots/AI - SECURITY FEATURE |
| 2024-12-29 | House protection suite | Circuit breaker, daily limits, reserve requirements |
| 2024-12-29 | Renamed to RiseJack | Align contract name with project branding |
| 2024-12-29 | VRF callback state validation | Added game state check in `rawFulfillRandomNumbers` |

---

## Notes

- Rise Chain has 10ms blocks and very low gas costs, so some gas optimizations are less critical
- VRF callbacks arrive in ~3-5ms, making the game feel responsive
- MockVRFCoordinator already exists in tests for local development
