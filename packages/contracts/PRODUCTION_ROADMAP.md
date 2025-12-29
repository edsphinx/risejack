# Blackjack Smart Contract - Production Roadmap

## Overview

This document tracks the development progress of the Blackjack smart contract from current state to production-ready deployment on Rise Chain mainnet.

**Current Status:** Security fixes implemented, 20/20 tests passing, ~62% coverage
**Target:** Production-ready contract with 90%+ coverage, real deck mechanics, and comprehensive security

---

## Audit Analysis Status

Review of findings from security analysis:

| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| A. DoS via failed payouts | HIGH | RESOLVED | Pull Payment pattern with `_safePayout()` and `pendingWithdrawals` |
| B. Infinite deck model | INFO | PENDING | Requires real shoe implementation for production |
| C. Gas limit on dynamic arrays | LOW | ACCEPTED | Statistically improbable; max cards ~11-12 per hand |
| D. VRF seed collisions | LOW | RESOLVED | Added `playerNonces` to all VRF seeds |

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

- [ ] **1.1 Core Game Flow Tests**
  - [ ] Full game: player wins with higher hand
  - [ ] Full game: dealer wins with higher hand
  - [ ] Full game: dealer busts
  - [ ] Full game: push (tie)
  - [ ] Multiple hits before stand

- [ ] **1.2 Edge Case Tests**
  - [ ] Player hits to exactly 21 (auto-stand)
  - [ ] Multiple aces in hand (soft to hard conversion)
  - [ ] Dealer soft 17 hit scenario
  - [ ] Double down winning/losing scenarios
  - [ ] Maximum cards in hand (gas limit test)

- [ ] **1.3 Security Tests**
  - [ ] Pending withdrawals flow
  - [ ] withdraw() function
  - [ ] Admin functions (setBetLimits, withdrawHouseFunds)
  - [ ] Ownership transfer
  - [ ] Unauthorized access attempts

- [ ] **1.4 Fuzz Testing**
  - [ ] Fuzz bet amounts within limits
  - [ ] Fuzz random card values
  - [ ] Fuzz multiple concurrent players

- [ ] **1.5 Invariant Testing**
  - [ ] Contract balance >= sum of pending payouts
  - [ ] Game state consistency
  - [ ] No funds locked permanently

---

## Phase 2: Real Deck Implementation

**Objective:** Replace infinite deck with realistic shoe mechanics

### Checkpoints

- [ ] **2.1 Shoe Data Structure**
  - [ ] Define Shoe struct (cards remaining, deck count)
  - [ ] Implement card tracking per session
  - [ ] Shuffle/reset mechanism when shoe runs low

- [ ] **2.2 Card Dealing Logic**
  - [ ] Modify `_randomToCard` to use shoe state
  - [ ] Handle card depletion gracefully
  - [ ] Configure number of decks (1, 2, 6, or 8)

- [ ] **2.3 Persistence Strategy**
  - [ ] Evaluate gas cost of shoe storage
  - [ ] Consider per-player vs global shoe
  - [ ] Implement efficient bit-packing if needed

---

## Phase 3: Timeout and Cleanup Mechanisms

**Objective:** Handle abandoned games and VRF failures

### Checkpoints

- [ ] **3.1 Game Timeout**
  - [ ] Add `GAME_TIMEOUT` constant (e.g., 1 hour)
  - [ ] Implement `cancelGame()` for timed out games
  - [ ] Refund logic for abandoned bets

- [ ] **3.2 VRF Request Timeout**
  - [ ] Track VRF request timestamps
  - [ ] Implement retry mechanism
  - [ ] Handle permanently unfulfilled requests

- [ ] **3.3 Admin Emergency Functions**
  - [ ] `pauseContract()` for emergencies
  - [ ] `forceResolveGame()` for stuck games
  - [ ] Proper access control on emergency functions

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
| Security Fixes | Complete | 100% |
| Phase 1: Testing | In Progress | 40% |
| Phase 2: Real Deck | Not Started | 0% |
| Phase 3: Timeouts | Not Started | 0% |
| Phase 4: Advanced | Not Started | 0% |
| Phase 5: Deployment | Not Started | 0% |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-12-29 | No OpenZeppelin | Avoid overhead; manual implementations sufficient |
| 2024-12-29 | Pull Payment pattern | Prevent DoS from reverting recipients |
| 2024-12-29 | Player nonces in VRF seed | Prevent theoretical collisions on fast L2 |

---

## Notes

- Rise Chain has 10ms blocks and very low gas costs, so some gas optimizations are less critical
- VRF callbacks arrive in ~3-5ms, making the game feel responsive
- MockVRFCoordinator already exists in tests for local development
