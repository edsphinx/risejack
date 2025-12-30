# Liquidity Pools & AMM

**Document Type:** Technical Specification  
**Version:** 0.1 (Draft)

---

## Overview

RISECASINO includes an integrated AMM (Automated Market Maker) for ETH/CHIP swaps. This enables seamless conversion between ETH and the casino's native gaming currency.

---

## AMM Design

### Model: Constant Product (Uniswap V2 Style)

```
x × y = k

Where:
- x = ETH reserve
- y = CHIP reserve
- k = constant (increases with fees)
```

### Why V2 Style?

- Simple & battle-tested
- Low gas costs
- Sufficient for single-pair use case
- Easy to audit

---

## Core Mechanics

### Swap ETH → CHIP (Buy CHIP)

```
Player wants to play:
1. Sends ETH to AMM
2. AMM calculates CHIP output (with 0.3% fee)
3. Player receives CHIP
4. Ready to play games
```

**Formula:**

```
output = (inputAmount × 997 × outputReserve) / (inputReserve × 1000 + inputAmount × 997)
```

### Swap CHIP → ETH (Sell CHIP)

```
Player cashes out:
1. Sends CHIP to AMM
2. AMM calculates ETH output (with 0.3% fee)
3. Player receives ETH
4. Winnings withdrawn
```

---

## Fee Structure

| Fee        | Amount | Distribution           |
| ---------- | ------ | ---------------------- |
| Swap Fee   | 0.30%  | Split below            |
| → LP Share | 0.20%  | To liquidity providers |
| → Protocol | 0.10%  | To Treasury            |

### Comparison to Other DEXs

| DEX            | Total Fee | LP Share | Protocol |
| -------------- | --------- | -------- | -------- |
| Uniswap V2     | 0.30%     | 0.30%    | 0%       |
| Uniswap V3     | 0.05-1%   | 100%     | 0%       |
| SushiSwap      | 0.30%     | 0.25%    | 0.05%    |
| **RISECASINO** | 0.30%     | 0.20%    | 0.10%    |

---

## Liquidity Provision

### Adding Liquidity

```
LP provides:
1. ETH + CHIP in ratio matching current pool ratio
2. Receives LP tokens proportional to share
3. Earns 0.20% of all swap fees
```

**Formula:**

```
lpTokensMinted = min(
    (amountETH × totalLPSupply) / ethReserve,
    (amountCHIP × totalLPSupply) / chipReserve
)
```

### Removing Liquidity

```
LP burns LP tokens:
1. Receives proportional ETH + CHIP
2. Plus accumulated fee earnings
```

---

## Initial Liquidity

### Launch Allocation

| Source   | ETH      | CHIP      | Purpose       |
| -------- | -------- | --------- | ------------- |
| Protocol | 10 ETH   | 400M CHIP | Initial pool  |
| Team     | Variable | Variable  | Price support |

### Initial Price Calculation

```
Initial CHIP/ETH ratio: 400,000,000 CHIP / 10 ETH = 40,000,000 CHIP per ETH

If ETH = $3,000:
Initial CHIP price = $3,000 / 40,000,000 = $0.000075
```

### Price Discovery

The market will find equilibrium through arbitrage and trading activity.

---

## Price Impact & Slippage

### Price Impact Formula

```
priceImpact = inputAmount / (inputAmount + inputReserve)

Example:
- Swapping 1 ETH into pool with 10 ETH reserve
- Price impact = 1 / (1 + 10) = 9.09%
```

### Slippage Protection

All swaps should include:

- Maximum slippage tolerance (default: 0.5-1%)
- Transaction deadline (default: 20 minutes)

---

## Smart Contract Design

### CHIPAMM.sol Interface

```solidity
interface ICHIPAMM {
    // Swap functions
    function swapETHForCHIP(uint256 minOutput, uint256 deadline) external payable returns (uint256);
    function swapCHIPForETH(uint256 chipAmount, uint256 minOutput, uint256 deadline) external returns (uint256);

    // Liquidity functions
    function addLiquidity(uint256 chipAmount, uint256 minLPTokens, uint256 deadline) external payable returns (uint256);
    function removeLiquidity(uint256 lpTokens, uint256 minETH, uint256 minCHIP, uint256 deadline) external returns (uint256, uint256);

    // View functions
    function getReserves() external view returns (uint256 ethReserve, uint256 chipReserve);
    function getAmountOut(uint256 amountIn, bool ethToChip) external view returns (uint256);
    function getLPBalance(address user) external view returns (uint256);

    // Protocol fee withdrawal
    function withdrawProtocolFees() external; // Only Treasury
}
```

### Key Contract Features

1. **No Admin Keys**: Immutable after deployment
2. **Reentrancy Protection**: All state changes before external calls
3. **Flash Loan Resistance**: Not applicable (no lending)
4. **Price Oracle**: TWAP for other contracts if needed

---

## LP Token (CHIP-LP)

```
Name: CHIP Liquidity Token
Symbol: CHIP-LP
Decimals: 18
Supply: Variable (minted/burned on add/remove)
```

### LP Token Utility

1. **Proof of Liquidity**: Represents share of pool
2. **Fee Earnings**: Automatically compounded
3. **Future Farming**: Possible staking for bonus CHIP

---

## Integration with Games

### Buy & Play Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         USER FLOW                            │
└─────────────────────────────────────────────────────────────┘

    ┌─────────┐                    ┌─────────┐
    │ Connect │──────────────────→ │ Deposit │
    │ Wallet  │                    │   ETH   │
    └─────────┘                    └────┬────┘
                                        │
                                        ↓
                                   ┌─────────┐
                              ┌────│   AMM   │────┐
                              │    │ETH→CHIP │    │
                              │    └─────────┘    │
                              │         │         │
                              │    0.3% Fee       │
                              │    ┌────┴────┐    │
                              │    ↓         ↓    │
                              │  0.2% LP   0.1%   │
                              │            Treasury│
                              │                   │
                              ↓                   │
                         ┌─────────┐              │
                         │  CHIP   │              │
                         │ Balance │              │
                         └────┬────┘              │
                              │                   │
                              ↓                   │
                         ┌─────────┐              │
                         │  PLAY   │              │
                         │RiseJack │              │
                         └────┬────┘              │
                              │                   │
                   ┌──────────┴──────────┐        │
                   ↓                     ↓        │
              ┌─────────┐          ┌─────────┐    │
              │   WIN   │          │  LOSE   │    │
              │ +CHIP   │          │ -CHIP   │────┘
              └────┬────┘          └─────────┘ (to house)
                   │
                   ↓
              ┌─────────┐
              │   AMM   │
              │CHIP→ETH │
              └────┬────┘
                   │
                   ↓
              ┌─────────┐
              │ Withdraw│
              │   ETH   │
              └─────────┘
```

---

## LP Incentives (Future)

### Potential Programs

| Program        | Mechanism                        | Purpose           |
| -------------- | -------------------------------- | ----------------- |
| LP Farming     | Stake LP tokens → earn CHIP      | Attract liquidity |
| Fee Boost      | Long-term LPs get higher share   | Retention         |
| Referral Bonus | Refer LPs → earn % of their fees | Growth            |

### Farming Emission Schedule (If Implemented)

| Period     | Daily CHIP | Total   |
| ---------- | ---------- | ------- |
| Month 1-3  | 100,000    | 9M      |
| Month 4-6  | 75,000     | 6.75M   |
| Month 7-12 | 50,000     | 9M      |
| Year 2+    | 25,000     | 9M/year |

---

## Security Considerations

| Risk               | Mitigation                            |
| ------------------ | ------------------------------------- |
| Impermanent Loss   | Clear warnings to LPs                 |
| Price Manipulation | TWAP oracle for game pricing          |
| Sandwich Attacks   | Slippage protection, private mempools |
| Flash Loan Attacks | No flash loan functionality           |
| Rug Pull           | No admin, no pause, immutable         |

---

## Comparison: Build vs. Use Existing DEX

| Factor           | Build Own       | Use Existing         |
| ---------------- | --------------- | -------------------- |
| Control          | ✅ Full control | ❌ Limited           |
| Protocol Revenue | ✅ 0.10% fees   | ❌ None              |
| UX Integration   | ✅ Seamless     | ⚠️ External redirect |
| Development Cost | ❌ High         | ✅ Zero              |
| Security         | ⚠️ New code     | ✅ Battle-tested     |

**Decision:** Build own AMM for:

- Protocol revenue (0.10% per swap)
- Seamless UX (in-app swaps)
- Full control over LP incentives

---

## Open Questions

1. **Should we support multi-hop?** (e.g., USDC → ETH → CHIP)
2. **Initial liquidity lock?** (e.g., lock team LP for 1 year)
3. **LP farming at launch?** (aggressive growth vs. sustainable)
4. **TWAP oracle period?** (30 min, 1 hour, etc.)

---

_Draft document - subject to revision_
