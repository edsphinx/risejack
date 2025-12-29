# RiseJack Smart Contract - Technical Report

## Executive Summary

RiseJack is a production-ready on-chain Blackjack game deployed on Rise Chain testnet. The contract implements provably fair gameplay using Rise VRF, comprehensive house protection mechanisms, and gas-optimized code.

**Deployment Status:** ✅ Live on Rise Testnet  
**Contract Address:** [`0x8a0AaDE6ebDaEF9993084a29a46BD1C93eC6001a`](https://explorer.testnet.riselabs.xyz/address/0x8a0aade6ebdaef9993084a29a46bd1c93ec6001a)

---

## Implementation Summary

### Core Features Implemented

| Feature | Status | Description |
|---------|--------|-------------|
| **Hit** | ✅ | Request additional cards |
| **Stand** | ✅ | End player turn |
| **Double Down** | ✅ | Double bet, receive one card |
| **Surrender** | ✅ | Forfeit half bet |
| **Blackjack Payout** | ✅ | 3:2 (150% profit) |
| **Dealer Rules** | ✅ | Hit on soft 17, stand on 17+ |

### House Protection

| Mechanism | Status | Description |
|-----------|--------|-------------|
| **Daily Profit Limit** | ✅ | Per-player cap prevents whale drain |
| **Min Reserve Auto-Pause** | ✅ | Contract pauses if balance too low |
| **Circuit Breaker** | ✅ | Auto-pause on anomalous losses |
| **Exposure Tracking** | ✅ | Real-time total risk monitoring |
| **Rate Limiting** | ✅ | 30-second cooldown between games |
| **Emergency Pause** | ✅ | Admin can halt operations |

### VRF Integration

| Feature | Status | Description |
|-----------|--------|-------------|
| **Rise VRF** | ✅ | Provably fair randomness |
| **VRF Timeout** | ✅ | 5-minute timeout with retry |
| **Force Resolve** | ✅ | Admin can rescue stuck games |
| **Request Validation** | ✅ | VRF coordinator contract check |

---

## Features Not Implemented

### Split Functionality
**Status:** Deferred  
**Reason:** Increases complexity significantly (multiple hands per player, additional VRF requests). Core gameplay is complete without it. Can be added in future version.

### Insurance Betting
**Status:** Deferred  
**Reason:** Rarely used in digital blackjack. Adds complexity without significant value. Core gameplay prioritized for initial release.

### Real Deck Tracking
**Status:** Cancelled  
**Reason:** This is an intentional **security decision**. On-chain card counting with bots/AI is trivial. Infinite deck (`random % 52`) ensures each card is statistically independent, preventing card counting attacks.

---

## Security Measures

### Implemented Protections

1. **Pull Payment Pattern** - Failed payouts stored in `pendingWithdrawals` for manual claim
2. **CEI Pattern** - All functions follow Checks-Effects-Interactions
3. **VRF Contract Validation** - Constructor verifies VRF coordinator is a contract
4. **Exposure Tracking** - Accurate tracking of house risk including doubled bets
5. **Modifier Consistency** - All modifiers use explicit parameters

### Security Audit Status

| Item | Status |
|------|--------|
| Internal Review | ✅ Complete |
| Fuzz Testing | ✅ 257+ runs per test |
| Invariant Testing | ✅ 640K+ handler calls |
| Medusa Fuzzer | ✅ 112K+ calls, 511 branches |
| External Audit | 🔜 Recommended before mainnet |

---

## Test Coverage

| Metric | Coverage |
|--------|----------|
| Lines | 91.23% (281/308) |
| Statements | 90.77% (295/325) |
| Branches | 70.59% (72/102) |
| Functions | 100% (40/40) |
| Tests Passing | 56/56 |

---

## Contract Configuration

| Parameter | Value |
|-----------|-------|
| Min Bet | 0.00001 ETH |
| Max Bet | 0.1 ETH |
| Blackjack Payout | 150% (3:2) |
| Game Timeout | 1 hour |
| VRF Timeout | 5 minutes |
| Cooldown | 30 seconds |
| Daily Profit Limit | 10 ETH per player |
| Min Reserve | 50 ETH |
| Circuit Breaker | 20 ETH loss / hour |

---

## Technology Stack

- **Language:** Solidity 0.8.28
- **Framework:** Foundry (Forge)
- **VRF:** Rise Chain VRF Coordinator
- **Blockchain:** Rise Chain (10ms blocks, low gas)
- **Verification:** Blockscout

---

## Next Steps

1. **Fund Contract** - Add ETH for player payouts
2. **Frontend Integration** - Connect web app to contract
3. **Mainnet Preparation** - External audit, multi-sig setup
4. **Feature Expansion** - Split, Insurance (optional)

---

## References

- [Deployment Changelog](./DEPLOYMENTS.md)
- [Contract Source](./src/RiseJack.sol)
- [Test Suite](./test/RiseJack.t.sol)
