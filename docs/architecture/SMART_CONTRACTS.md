# Smart Contract Architecture

**Document Type:** Technical Architecture  
**Version:** 0.1 (Draft)

---

## Security-First Approach

RISECASINO prioritizes security by forking battle-tested, audited contracts rather than writing from scratch. This document analyzes the best options for each component.

---

## Contract Inventory

| Contract    | Purpose                           | Risk Level |
| ----------- | --------------------------------- | ---------- |
| CHIPToken   | ERC-20 gaming currency            | Low        |
| CHIPAMM     | ETH/CHIP liquidity pool           | Medium     |
| CHIPStaking | Stake CHIP for yield              | Medium     |
| Treasury    | Revenue collection & distribution | Medium     |
| RiseJack    | Blackjack game (existing)         | High       |

---

## Component Analysis

### 1. CHIP Token (ERC-20)

#### Options Analyzed

| Option                 | Pros                            | Cons                 | Verdict     |
| ---------------------- | ------------------------------- | -------------------- | ----------- |
| **OpenZeppelin ERC20** | Industry standard, most audited | Basic features only  | ✅ **Best** |
| Solmate ERC20          | Gas optimized                   | Less audited         | ⚠️ Good     |
| Custom ERC20           | Full control                    | High risk, no audits | ❌ Avoid    |

#### Recommendation: OpenZeppelin ERC20

```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CHIP is ERC20, Ownable {
    constructor() ERC20("Rise Casino Chip", "CHIP") {
        _mint(msg.sender, 1_000_000_000 * 10**18); // 1B supply
    }

    // Optional: burn function for buyback mechanism
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
```

**Why OpenZeppelin:**

- 100+ audits across versions
- Used by $100B+ in TVL
- Well-documented
- Community support
- EIP-compliant

---

### 2. AMM / DEX

#### Options Analyzed

| Option         | Pros                           | Cons                              | Verdict     |
| -------------- | ------------------------------ | --------------------------------- | ----------- |
| **Uniswap V2** | Simple, audited, battle-tested | Older design                      | ✅ **Best** |
| Uniswap V3     | Capital efficient              | Complex, overkill for single pair | ❌ Overkill |
| Balancer       | Multi-asset pools              | Too complex                       | ❌ Overkill |
| Custom AMM     | Full control                   | High risk                         | ❌ Avoid    |

#### Recommendation: Fork Uniswap V2

**Why Uniswap V2:**

- 4+ years of battle-testing
- Multiple audits (Trail of Bits, others)
- $2B+ TVL at peak
- Simple constant product model perfect for single pair
- Easy to modify fee structure

**Required Modifications:**

| Change                              | Reason               | Risk |
| ----------------------------------- | -------------------- | ---- |
| Fee split (0.2% LP / 0.1% protocol) | Revenue model        | Low  |
| Remove factory (single pair)        | Simplicity           | Low  |
| Add protocol fee withdrawal         | Treasury integration | Low  |

**Files to Fork:**

```
@uniswap/v2-core/
├── UniswapV2Pair.sol    → CHIPPair.sol (modify fee)
└── UniswapV2Factory.sol → Remove (not needed)

@uniswap/v2-periphery/
└── UniswapV2Router02.sol → CHIPRouter.sol (simplify)
```

---

### 3. Staking

#### Options Analyzed

| Option                       | Pros                  | Cons               | Verdict        |
| ---------------------------- | --------------------- | ------------------ | -------------- |
| **Synthetix StakingRewards** | Simple, widely forked | No lock tiers      | ✅ **Best**    |
| Sushi MasterChef             | Emission-based        | Inflationary model | ⚠️ Alternative |
| Convex/Curve veCRV           | Lock multipliers      | Very complex       | ❌ Overkill    |
| Custom Staking               | Full control          | High risk          | ❌ Avoid       |

#### Recommendation: Fork Synthetix StakingRewards

**Why Synthetix StakingRewards:**

- Simple, single-file contract
- Audited multiple times
- Perfect for "real yield" distribution
- Used by 100+ protocols
- Easy to understand

**Contract Source:**

```
https://github.com/Synthetixio/synthetix/blob/develop/contracts/StakingRewards.sol
```

**How It Works:**

```solidity
// Rewards are distributed per-second based on stake weight
rewardPerToken = rewardPerTokenStored +
    ((lastTimeRewardApplicable - lastUpdateTime) * rewardRate * 1e18) / totalStaked;

userReward = (userStake * (rewardPerToken - userRewardPerTokenPaid)) / 1e18;
```

**Modifications Needed:**

| Change                            | Reason            | Risk   |
| --------------------------------- | ----------------- | ------ |
| Replace SNX with CHIP             | Token swap        | None   |
| Add Treasury as rewardDistributor | Auto-distribution | Low    |
| Optional: Add lock tiers          | Future feature    | Medium |

---

### 4. Treasury

#### Options Analyzed

| Option                      | Pros               | Cons                    | Verdict        |
| --------------------------- | ------------------ | ----------------------- | -------------- |
| **Simple Ownable Treasury** | Minimal, auditable | Single point of control | ✅ **MVP**     |
| OpenZeppelin Governor       | DAO governance     | Too complex for MVP     | ⚠️ Future      |
| Gnosis Safe                 | Multisig           | External dependency     | ⚠️ Alternative |

#### Recommendation: Simple Treasury for MVP

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury is Ownable {
    IERC20 public chip;
    address public stakingPool;

    // Distribution ratios (basis points, 10000 = 100%)
    uint256 public stakingShare = 5000;  // 50%
    uint256 public buybackShare = 2000;  // 20%
    // Remaining 30% stays in treasury

    function distribute() external {
        uint256 balance = chip.balanceOf(address(this));
        uint256 toStaking = (balance * stakingShare) / 10000;
        uint256 toBuyback = (balance * buybackShare) / 10000;

        chip.transfer(stakingPool, toStaking);
        // Buyback logic...
    }
}
```

**Future: Migrate to Governor**
After launch, can migrate to OpenZeppelin Governor for decentralized control.

---

### 5. RiseJack (Existing)

Already implemented. Needs:

- Audit before mainnet
- Integration with CHIP token (instead of ETH)
- Connection to Treasury for house edge

---

## Dependency Summary

```
📦 Foundry Dependencies:

forge install OpenZeppelin/openzeppelin-contracts
forge install Uniswap/v2-core
forge install Uniswap/v2-periphery
# Synthetix StakingRewards - copy single file
```

## Contract Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTRACT ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────┘

                         ┌──────────────┐
                         │   CHIP ERC20 │
                         │ (OZ Standard)│
                         └──────┬───────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│   CHIPPair    │       │ CHIPStaking   │       │   Treasury    │
│  (Uni V2 fork)│       │(Synthetix fork│       │  (OZ Ownable) │
└───────┬───────┘       └───────┬───────┘       └───────┬───────┘
        │                       │                       │
        │ Swap fees ──────────────────────────────────→ │
        │                       │ ←── Rewards ──────────│
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │   RiseJack    │
                        │   (Custom)    │
                        └───────────────┘
                                │
                    House edge ─┘→ Treasury
```

---

## Security Checklist

### Pre-Deployment

- [ ] OpenZeppelin contracts: Use latest stable version
- [ ] Uniswap V2 fork: Verify no modifications break invariants
- [ ] Synthetix fork: Validate reward math
- [ ] All contracts: Slither/Mythril static analysis
- [ ] All contracts: 100% test coverage
- [ ] Integration tests: Full user flow simulation

### Audit Priority

| Contract                    | Priority    | Reason                           |
| --------------------------- | ----------- | -------------------------------- |
| RiseJack                    | 🔴 Critical | Custom game logic, handles funds |
| CHIPPair (fee modification) | 🟡 High     | Modified from audited base       |
| CHIPStaking                 | 🟡 High     | Handles staked funds             |
| Treasury                    | 🟢 Medium   | Simple, limited attack surface   |
| CHIP Token                  | 🟢 Low      | Unmodified OZ standard           |

---

## Alternative Considered: Use Existing DEX

**Scenario:** Deploy CHIP, list on existing Rise Chain DEX (if available)

| Pro                      | Con                           |
| ------------------------ | ----------------------------- |
| Zero DEX development     | No protocol fees (0.1% lost)  |
| Battle-tested from day 1 | External UX (redirect to DEX) |
| Faster launch            | Less control over liquidity   |

**Decision:** Build own for:

1. Protocol revenue (0.1% per swap)
2. Seamless in-app UX
3. Full control over LP incentives

If Rise Chain has no DEX at launch, this decision is mandatory anyway.

---

## Gas Optimization Notes

For Rise Chain's 10ms blocks, gas efficiency is less critical than on Ethereum mainnet. However:

- Uniswap V2 is already gas-optimized
- OpenZeppelin contracts are well-optimized
- Synthetix contracts use efficient reward distribution

No need for Solmate's aggressive optimizations.

---

## Open Questions

1. **Rise Chain compatibility?** Need to verify all EVM opcodes supported
2. **VRF integration?** RiseJack already uses Rise VRF - confirm CHIP games will too
3. **Multisig for Treasury?** Consider Gnosis Safe from day 1 vs. Ownable

---

_Draft document - subject to technical review_
