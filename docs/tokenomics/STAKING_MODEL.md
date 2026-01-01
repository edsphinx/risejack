# Staking Model

**Document Type:** Technical Specification  
**Version:** 0.1 (Draft)

---

## Overview

The RISECASINO staking model allows CHIP holders to stake their tokens and earn a share of the casino's house revenue. This creates aligned incentives between the platform and its token holders.

---

## Core Mechanics

### Staking Flow

```
1. User stakes CHIP → CHIPStaking contract
2. User receives proportional share of staking pool
3. House revenue (in CHIP) deposited to pool
4. User claims rewards or compounds
5. User can unstake anytime (no lock by default)
```

### Reward Calculation

```
User Reward = (User Stake / Total Staked) × Revenue Pool

Example:
- User staked: 100,000 CHIP
- Total staked: 10,000,000 CHIP
- Revenue this period: 50,000 CHIP
- User reward: (100,000 / 10,000,000) × 50,000 = 500 CHIP
```

---

## Staking Tiers (Optional)

To incentivize longer-term staking:

| Tier    | Lock Period | Reward Multiplier | Est. APY |
| ------- | ----------- | ----------------- | -------- |
| Flex    | 0 (no lock) | 1.0x              | 5-8%     |
| Silver  | 30 days     | 1.2x              | 6-10%    |
| Gold    | 90 days     | 1.5x              | 8-12%    |
| Diamond | 365 days    | 2.0x              | 10-16%   |

### Why Tiers?

- Reduces sell pressure (locked tokens)
- Rewards commitment
- Creates predictable liquidity

### Trade-offs

- Complexity for users
- Smart contract risk during lock
- May discourage smaller stakes

**Decision:** Start with Flex-only, add tiers in V2.

---

## APY Dynamics

Unlike emission-based staking, RISECASINO staking APY is **real yield**:

```
APY = (Annual House Revenue × Staker Share) / Total Staked Value

Example:
- Annual revenue: $1,000,000
- Staker share: 50% = $500,000
- Total staked: $10,000,000 worth of CHIP
- APY: $500,000 / $10,000,000 = 5%
```

### Variable APY

- More revenue → Higher APY
- More stakers → Lower APY per person
- CHIP price changes affect $ APY but not CHIP APY

---

## Reward Source

Staking rewards come from:

| Source                     | % of Pool |
| -------------------------- | --------- |
| House edge (games)         | 80%       |
| Swap fees (protocol share) | 15%       |
| Premium features           | 5%        |

All rewards are in CHIP tokens.

---

## Smart Contract Design

### CHIPStaking.sol Interface

```solidity
interface ICHIPStaking {
    // Stake CHIP tokens
    function stake(uint256 amount) external;

    // Unstake (with optional lockup check)
    function unstake(uint256 amount) external;

    // Claim pending rewards
    function claimRewards() external;

    // Compound rewards into stake
    function compound() external;

    // View pending rewards
    function pendingRewards(address user) external view returns (uint256);

    // Deposit rewards from casino (called by Treasury)
    function depositRewards(uint256 amount) external;
}
```

### Key Features

1. **No Minimum Stake**: Anyone can stake any amount
2. **Instant Unstake**: Flex tier has no lock (at launch)
3. **No Withdrawal Fee**: Full principal returned
4. **Real-Time Accrual**: Rewards calculated per-second

---

## Revenue Distribution Schedule

```
Casino Revenue Generated
         │
         ↓ (daily batch)
   ┌─────────────┐
   │  Treasury   │
   └─────────────┘
         │
    50% to Staking Pool
         │
         ↓
   ┌─────────────┐
   │ CHIPStaking │
   └─────────────┘
         │
    Distributed to
    stakers by share
```

### Frequency

- Revenue accumulated in Treasury
- Distributed to staking pool **daily** (or per-tx)
- Users can claim anytime

---

## Security Considerations

| Risk               | Mitigation                          |
| ------------------ | ----------------------------------- |
| Flash loan attacks | Snapshot-based rewards, not instant |
| Reward drain       | Rate limiting on deposits           |
| Reentrancy         | ReentrancyGuard on all functions    |
| Inflation bug      | Fixed supply, no minting in staking |

---

## Comparison to Other Models

| Protocol    | Model              | APY Source   | RISECASINO |
| ----------- | ------------------ | ------------ | ---------- |
| Olympus     | Rebase emissions   | Inflation    | ❌         |
| GMX         | esGMX + multiplier | Trading fees | ✅ Similar |
| Curve       | veCRV locked       | Trading fees | ✅ Similar |
| PancakeSwap | CAKE emissions     | Inflation    | ❌         |

RISECASINO is closest to GMX model: real revenue sharing, no inflation.

---

## Projected Metrics

| Scenario | Total Staked | Annual Revenue | APY |
| -------- | ------------ | -------------- | --- |
| Launch   | $1M          | $200k          | 10% |
| Growth   | $5M          | $1M            | 10% |
| Maturity | $20M         | $4M            | 10% |

Note: APY stays relatively stable as both staking and revenue scale.

---

## Open Questions

1. **Should we add a staking cap?** (prevent whale dominance)
2. **Reward token flexibility?** (CHIP only, or also ETH?)
3. **Unstaking cooldown?** (e.g., 7 days for Flex)
4. **Auto-compound option?** (gas-optimized batching)

---

_Draft document - subject to revision_
