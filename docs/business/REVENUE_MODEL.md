# Revenue Model

**Document Type:** Business Analysis  
**Version:** 0.1 (Draft)

---

## Executive Summary

RISECASINO generates revenue from four primary streams: house edge, swap fees, staking spreads, and premium features. This document details each stream, expected margins, and sustainability analysis.

---

## Revenue Streams Overview

| Stream               | Mechanism                       | Est. Contribution |
| -------------------- | ------------------------------- | ----------------- |
| **House Edge**       | Mathematical advantage in games | 70%               |
| **Swap Fees**        | 0.3% on ETH↔CHIP trades         | 15%               |
| **Staking Spread**   | Difference between yields       | 10%               |
| **Premium Features** | VIP, cosmetics                  | 5%                |

---

## 1. House Edge Revenue

### Concept

Every casino game has a built-in mathematical advantage for the house. Over many plays, the house retains this percentage of total wagered amount.

### Per-Game Analysis

| Game                 | House Edge | Notes                   |
| -------------------- | ---------- | ----------------------- |
| RiseJack (Blackjack) | 0.5-2%     | Depends on player skill |
| Roulette (planned)   | 2.7%       | Single zero European    |
| Dice (planned)       | 1-2%       | Configurable            |
| Slots (planned)      | 5-10%      | Highest margin          |

### Expected Revenue Calculation

```
Daily Wagered Volume:   $100,000
Average House Edge:     3%
Daily House Revenue:    $3,000
Monthly House Revenue:  $90,000
Annual House Revenue:   $1,080,000
```

### Scaling Factors

- More games = more volume
- Marketing = more players
- VIP players contribute disproportionately (top 10% often = 50% of volume)

---

## 2. Swap Fees (AMM)

### Concept

The ETH/CHIP AMM charges 0.3% on every swap. Half goes to LPs, half to the protocol.

### Fee Structure

```
Total Swap Fee:    0.3%
├── LP Share:      0.15%
└── Protocol:      0.15%
```

### Expected Revenue

```
Daily Swap Volume:     $50,000
Protocol Fee (0.15%):  $75/day
Monthly:               $2,250
Annual:                $27,000
```

### Growth Drivers

- Game activity drives swaps (deposit/withdraw cycle)
- External arbitrage adds volume
- More games = more swap activity

---

## 3. Staking Spread

### Concept

If house revenue yields 10% APY equivalent but we only distribute 7% to stakers, the 3% spread is additional revenue.

### Model

```
House Revenue (annual):   $1,000,000
Distributed to Stakers:   70% = $700,000 (7% APY on $10M staked)
Protocol Retention:       30% = $300,000
```

### Why This Works

- Stakers get "real yield" (actual revenue, not emissions)
- Higher yields than most DeFi (where 3-5% is normal)
- Protocol keeps meaningful portion for operations

---

## 4. Premium Features (Future)

### Potential Revenue Streams

| Feature      | Model                     | Est. Revenue  |
| ------------ | ------------------------- | ------------- |
| VIP Tables   | Higher limits, lower edge | Subscription  |
| Cosmetics    | Card backs, table themes  | One-time/NFT  |
| Leaderboards | Entry fee tournaments     | % of pool     |
| Referrals    | Revenue share             | Marginal cost |

### Revenue Potential

Initially minimal but can scale to 10-20% of total revenue at maturity.

---

## Revenue Distribution

All revenue flows into a central Treasury contract, then distributed:

```
┌─────────────────────────────────────────────────────────┐
│                   TOTAL REVENUE                          │
│         (House Edge + Swap Fees + Premium)               │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
  ┌─────┴─────┐       ┌─────┴─────┐       ┌─────┴─────┐
  │  STAKERS  │       │ TREASURY  │       │  BUYBACK  │
  │    50%    │       │    30%    │       │    20%    │
  └───────────┘       └───────────┘       └───────────┘
        │                   │                   │
  Distributed to      Operations,         Buy CHIP from
  CHIP stakers        Development,        market & burn
  proportionally      Marketing
```

---

## Financial Projections

### Year 1 Scenarios

| Scenario     | Daily Volume | House Edge | Annual Revenue |
| ------------ | ------------ | ---------- | -------------- |
| Conservative | $25,000      | $750       | $273,750       |
| Moderate     | $100,000     | $3,000     | $1,095,000     |
| Optimistic   | $500,000     | $15,000    | $5,475,000     |

### Break-Even Analysis

**Fixed Costs (Est.):**

- Development: $50,000/year
- Infrastructure: $12,000/year
- Security/Audits: $30,000/year
- Marketing: $20,000/year
- **Total:** $112,000/year

**Break-Even Volume:**

```
$112,000 / 365 days / 3% edge = $10,228/day wagered
```

This is achievable with ~50-100 active players per day.

---

## Sustainability Analysis

### Positive Flywheel

```
More Players → More Volume → More Revenue
    ↑                              ↓
    └──── Higher Staking APY ←────┘
              ↓
        More CHIP Demand
              ↓
        Higher CHIP Price
              ↓
        More Attention/Players
```

### Risk Factors

| Risk        | Impact   | Probability | Mitigation            |
| ----------- | -------- | ----------- | --------------------- |
| Low volume  | Critical | Medium      | Marketing, more games |
| Large wins  | High     | Low         | Bet limits, reserves  |
| Competition | Medium   | Medium      | First-mover, UX       |
| Regulatory  | High     | Low         | Geo-blocking, legal   |

---

## Key Metrics to Track

| Metric               | Target    | Frequency |
| -------------------- | --------- | --------- |
| Daily Active Users   | 100+      | Daily     |
| Daily Wagered Volume | $50k+     | Daily     |
| House Edge Realized  | 2-4%      | Weekly    |
| CHIP Price           | Stable/Up | Daily     |
| Staking APY          | 5-15%     | Weekly    |
| LP TVL               | $500k+    | Daily     |

---

## Conclusion

The revenue model is sustainable with moderate volume assumptions. The key success factors are:

1. **Achieve $50k+/day wagered volume** within 3 months
2. **Maintain healthy CHIP liquidity** (>$500k TVL)
3. **Deliver consistent staking yields** (5-15% APY)
4. **Launch new games quarterly** to drive growth

---

_Draft document - financial projections are estimates and not guarantees_
