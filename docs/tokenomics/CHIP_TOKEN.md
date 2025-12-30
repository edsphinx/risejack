# CHIP Token Design

**Document Type:** Technical Specification  
**Version:** 0.1 (Draft)

---

## Overview

CHIP is an ERC-20 token that serves as the universal currency within the RISECASINO ecosystem. It is designed to create a closed-loop economy where value flows between players, stakers, and the house.

---

## Token Specification

```solidity
Name:        Rise Casino Chip
Symbol:      CHIP
Decimals:    18
Total Supply: 1,000,000,000 (fixed)
Standard:    ERC-20
Chain:       Rise Chain
```

---

## Core Design Decisions

### Why One Fungible Token vs. Denomination NFTs?

| Factor             | Single ERC-20      | Denomination NFTs     |
| ------------------ | ------------------ | --------------------- |
| DeFi Compatibility | ✅ Excellent       | ❌ Poor               |
| Liquidity          | ✅ Concentrated    | ❌ Fragmented         |
| Staking            | ✅ Simple          | ❌ Complex            |
| Gas Efficiency     | ✅ Single transfer | ❌ Multiple transfers |
| Casino Feel        | ⚠️ Less authentic  | ✅ Authentic          |

**Decision:** Single ERC-20 for practical DeFi utility. The "casino feel" is achieved through UI (visual chip representations) rather than token mechanics.

### Why Fixed Supply?

- **Predictable Scarcity**: No inflationary surprises
- **Simple Tokenomics**: Easier to model and audit
- **Buyback Value**: Burns actually reduce supply

---

## Utility

### 1. Gaming Currency

```
Player deposits ETH → Swaps to CHIP → Places bets in CHIP
```

- All games accept CHIP only
- Winnings paid in CHIP
- Can swap back to ETH anytime

### 2. Staking Rewards

```
Stake CHIP → Earn % of house revenue (in CHIP)
```

- Stakers receive portion of house edge
- Real yield from actual revenue, not emissions

### 3. Liquidity Provision

```
Provide ETH + CHIP to AMM → Earn trading fees
```

- 0.3% fee on all swaps
- LPs earn proportional share

### 4. Governance (Future)

```
Hold CHIP → Vote on proposals
```

- New game additions
- Fee structure changes
- Treasury allocations

---

## Token Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       TOKEN FLOW                             │
└─────────────────────────────────────────────────────────────┘

    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │  Player  │ ─ETH→  │   AMM    │ ─CHIP→ │  Player  │
    └──────────┘        └──────────┘        └──────────┘
         │                   ↓ (0.3%)            │
         │              ┌─────────┐              │
         │              │   LPs   │              │
         │              └─────────┘              │
         │                                       │
         └──────────────CHIP─────────────────────┘
                         │
                         ↓ (bets)
                  ┌──────────────┐
                  │    GAMES     │
                  │  (RiseJack)  │
                  └──────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
     ┌──────┴──────┐          ┌───────┴───────┐
     │   Winnings  │          │  House Edge   │
     │ (to player) │          │   (~2-5%)     │
     └─────────────┘          └───────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
             ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐
             │  Staking    │   │  Treasury   │   │  Buyback    │
             │  Rewards    │   │   (ops)     │   │  & Burn     │
             │    50%      │   │    30%      │   │    20%      │
             └─────────────┘   └─────────────┘   └─────────────┘
```

---

## Initial Distribution

| Allocation      | Amount      | %   | Purpose           | Vesting              |
| --------------- | ----------- | --- | ----------------- | -------------------- |
| Liquidity Pool  | 400,000,000 | 40% | AMM liquidity     | Locked forever       |
| Staking Rewards | 250,000,000 | 25% | Yield for stakers | 4-year emission      |
| Team            | 150,000,000 | 15% | Team compensation | 1yr cliff + 2yr vest |
| Treasury        | 100,000,000 | 10% | Operations, dev   | DAO controlled       |
| Public Sale     | 100,000,000 | 10% | Initial buyers    | No vesting           |

---

## Price Mechanics

### What Drives Price Up

1. **Buyback Pressure**: 20% of house revenue buys CHIP from market
2. **Staking Lock**: Staked CHIP removed from circulation
3. **LP Lock**: 40% supply locked in AMM
4. **Demand**: Required to play games

### What Drives Price Down

1. **Winner Withdrawals**: Winners swap CHIP → ETH
2. **Team Unlocks**: After vesting period
3. **Staker Exits**: Unstaking and selling

### Equilibrium

The system reaches equilibrium when:

```
(New players buying CHIP) + (Buyback) ≈ (Winners selling) + (Staker exits)
```

---

## Smart Contract Requirements

### CHIPToken.sol

```solidity
interface ICHIP is IERC20 {
    // Standard ERC-20 functions

    // Minting (only by deployer at launch)
    function mint(address to, uint256 amount) external;

    // Burning (for buyback mechanism)
    function burn(uint256 amount) external;

    // Owner can renounce minting ability
    function renounceMinter() external;
}
```

### Key Security Considerations

1. **Fixed Supply**: Minting disabled after initial distribution
2. **No Pausable**: Cannot freeze user funds
3. **No Blacklist**: Fully permissionless
4. **No Owner Privileges**: Renounced after launch

---

## Risks

| Risk                                                                   | Impact   | Mitigation                              |
| ---------------------------------------------------------------------- | -------- | --------------------------------------- |
| Death spiral (price drops → less players → less revenue → price drops) | Critical | Treasury reserves, marketing, new games |
| Liquidity drain                                                        | High     | LP incentives, deep initial liquidity   |
| Whale manipulation                                                     | Medium   | Vesting, max wallet limits (consider)   |
| Smart contract bug                                                     | Critical | Audits, bug bounty                      |

---

## Open Questions

1. **Should there be a buy/sell tax?** (e.g., 1% tax redistributed to stakers)
2. **Max wallet limit?** (e.g., 2% of supply per wallet)
3. **LP incentives beyond fees?** (e.g., CHIP emissions to LPs)
4. **Initial pricing?** (e.g., $0.001, $0.01, $0.10)

---

_Draft document - subject to review and revision_
