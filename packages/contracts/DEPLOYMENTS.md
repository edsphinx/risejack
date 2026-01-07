# VyreCasino Deployment Changelog

## Rise Testnet

---

## VyreCasino Architecture v2.0 - 2026-01-06

**Deployed via Safe SDK with multisig ownership**

### VyreTreasury

**Contract:** VyreTreasury  
**Address:** [`0x53052Fc42f81bf211a81C5b99Ec1fAAc42522644`](https://explorer.testnet.riselabs.xyz/address/0x53052Fc42f81bf211a81C5b99Ec1fAAc42522644)  
**Owner:** SAFE Multisig `0x108ca5cf713cb0b964d187f19cd7b7d317841c31`  
**Verified:** ✅ [Blockscout](https://explorer.testnet.riselabs.xyz/address/0x53052Fc42f81bf211a81C5b99Ec1fAAc42522644#code)

**Treasury Balances:**

| Token | Amount    |
| ----- | --------- |
| CHIP  | 8,000,000 |
| USDC  | 500       |

### VyreCasino

**Contract:** VyreCasino (Central Orchestrator)  
**Address:** [`0xB841E36b03801B658aaB347F696232f99b844d83`](https://explorer.testnet.riselabs.xyz/address/0xB841E36b03801B658aaB347F696232f99b844d83)  
**Owner:** SAFE Multisig  
**Verified:** ✅ [Blockscout](https://explorer.testnet.riselabs.xyz/address/0xB841E36b03801B658aaB347F696232f99b844d83#code)

**Configuration:**

| Setting            | Value                                        |
| ------------------ | -------------------------------------------- |
| Treasury           | `0x53052Fc42f81bf211a81C5b99Ec1fAAc42522644` |
| CHIP Token         | `0x18cA3c414bD08C74622C3E3bFE7464903d95602A` |
| House Edge         | 2% (200 bps)                                 |
| Whitelisted Tokens | CHIP, USDC                                   |

### VyreJackCore

**Contract:** VyreJackCore (Blackjack Game)  
**Address:** [`0x4a9b126eD3B0a686c803ace5dfA5d220b7b7496B`](https://explorer.testnet.riselabs.xyz/address/0x4a9b126eD3B0a686c803ace5dfA5d220b7b7496B)  
**Owner:** SAFE Multisig  
**VRF Coordinator:** `0x9d57aB4517ba97349551C876a01a7580B1338909`  
**Verified:** ✅ [Blockscout](https://explorer.testnet.riselabs.xyz/address/0x4a9b126eD3B0a686c803ace5dfA5d220b7b7496B#code)

### Ownership Structure

```
SAFE Multisig (2/3) ─────────────────────────────────────────
│                       0x108ca5cf...31                      │
├────────────────┬──────────────────┬────────────────────────┤
▼                ▼                  ▼
VyreTreasury    VyreCasino        VyreJackCore
(holds funds)   (orchestrator)    (game logic)
```

---

### VyreJackETH v1.0.1 (Standalone) - 2024-12-29

### v1.0.1 - 2024-12-29

**Contract:** RiseJack  
**Address:** [`0xe17C645aE8dC321B41BA00bbc8B9E392342A0cA2`](https://explorer.testnet.riselabs.xyz/address/0xe17C645aE8dC321B41BA00bbc8B9E392342A0cA2)  
**Chain ID:** 11155931  
**TX Hash:** `0xaa4a984769a9f105688de07e3812c1a7c89ab62057004c6226ff3bac5c0ca041`  
**Block:** 31982956  
**Verified:** ✅ [Blockscout](https://explorer.testnet.riselabs.xyz/address/0xe17c645ae8dc321b41ba00bbc8b9e392342a0ca2)

#### Configuration (Optimized for testnet)

| Parameter       | Value            |
| --------------- | ---------------- |
| VRF Coordinator | Default Rise VRF |
| Min Bet         | 0.00001 ETH      |
| Max Bet         | 0.1 ETH          |
| VRF Timeout     | 10 seconds       |
| Game Cooldown   | 0 seconds        |
| Initial Fund    | 0.001 ETH        |

#### Changes from v1.0.0

- **Enhanced `GameEnded` event** - Now includes `playerFinalValue`, `dealerFinalValue`, `playerCardCount`, `dealerCardCount`
- **Configurable timeouts** - `vrfTimeout` and `gameCooldown` are now admin-settable
- **New admin functions** - `setVRFTimeout()`, `setGameCooldown()`

---

## DeFi Contracts - 2024-12-30

### CHIPToken (v3 - Hardhat + SAFE Owner)

**Contract:** CHIPToken (ERC20)  
**Address:** [`0x18cA3c414bD08C74622C3E3bFE7464903d95602A`](https://explorer.testnet.riselabs.xyz/address/0x18cA3c414bD08C74622C3E3bFE7464903d95602A)  
**Symbol:** CHIP  
**Initial Supply:** 1,000,000,000 CHIP  
**Owner:** SAFE Multisig (see private docs)  
**Verified:** ✅ [Blockscout](https://explorer.testnet.riselabs.xyz/address/0x18cA3c414bD08C74622C3E3bFE7464903d95602A#code)  
**Deployed With:** Hardhat 2.22.17

### UniswapV2Factory (risecasinoswap)

**Contract:** UniswapV2Factory  
**Address:** [`0xB3c8D76d227A8937898BE6c3e1C99ed22CcB5040`](https://explorer.testnet.riselabs.xyz/address/0xb3c8d76d227a8937898be6c3e1c99ed22ccb5040)  
**Source:** Original Uniswap V2 Core (Audited by dApp.org)  
**Solidity:** 0.5.16  
**Verified:** ✅ Blockscout

### UniswapV2Router02 (risecasinorouter)

**Contract:** UniswapV2Router02  
**Address:** [`0x67b3925D7b2b2d9BD316DAC8bCF888A60B9F24F0`](https://explorer.testnet.riselabs.xyz/address/0x67b3925d7b2b2d9bd316dac8bcf888a60b9f24f0)  
**Source:** Original Uniswap V2 Periphery (Audited by dApp.org)  
**Solidity:** 0.6.6  
**WETH:** `0x4200000000000000000000000000000000000006`  
**Verified:** ✅ Blockscout

### CHIP/ETH Liquidity Pool

**Contract:** UniswapV2Pair  
**Address:** [`0x5A36854D9a48957BF78790E974BFC01fbF123a84`](https://explorer.testnet.riselabs.xyz/address/0x5a36854d9a48957bf78790e974bfc01fbf123a84)  
**Initial Liquidity:** 0.0001 ETH + 1000 CHIP  
**Created by:** Factory

### StakingRewards (risecasinosimplestaking)

**Contract:** StakingRewards  
**Address:** [`0x9eEE56e0907AA69f023b29a93Ae5ea54CA8DD8c3`](https://explorer.testnet.riselabs.xyz/address/0x9eee56e0907aa69f023b29a93ae5ea54ca8dd8c3)  
**Source:** Original Synthetix StakingRewards (Audited by Synthetix)  
**Solidity:** 0.5.16  
**Rewards Token:** CHIP (`0x2D97Ba366119e55B1a98D9349ce35868920C7Ae8`)  
**Staking Token:** CHIP/ETH LP (`0x5A36854D9a48957BF78790E974BFC01fbF123a84`)  
**Verified:** ✅ Blockscout

---

### v1.0.0 - 2024-12-29 (Deprecated)

**Contract:** RiseJack  
**Address:** [`0x8a0AaDE6ebDaEF9993084a29a46BD1C93eC6001a`](https://explorer.testnet.riselabs.xyz/address/0x8a0aade6ebdaef9993084a29a46bd1c93ec6001a)  
**Chain ID:** 11155931  
**TX Hash:** `0x38dde0765b7e96f805d2d9806ee1a3e4d8ac5e7cb5b18e7e50103486ff078bf0`  
**Status:** ⛔ Deprecated - Funds withdrawn  
**Verified:** ✅ Blockscout

#### Configuration

| Parameter       | Value                                        |
| --------------- | -------------------------------------------- |
| VRF Coordinator | `0x9d57aB4517ba97349551C876a01a7580B1338909` |
| Min Bet         | 0.001 ETH                                    |
| Max Bet         | 1 ETH                                        |
| VRF Timeout     | 5 minutes (hardcoded)                        |
| Game Cooldown   | 30 seconds (hardcoded)                       |

#### Features

- Core gameplay (hit, stand, double, surrender)
- Rise VRF integration
- House protection (daily limits, circuit breaker)
- Admin functions (pause, force resolve, withdraw)

---

## Deployment Commands

### Rise Testnet

```bash
source .env
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url https://testnet.riselabs.xyz \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url 'https://explorer.testnet.riselabs.xyz/api/'
```

### Verify Existing Contract

```bash
export ETHERSCAN_API_KEY=dummy
forge verify-contract \
  --rpc-url https://testnet.riselabs.xyz \
  --verifier blockscout \
  --verifier-url 'https://explorer.testnet.riselabs.xyz/api/' \
  <address> \
  src/RiseJack.sol:RiseJack
```

---

## Future Deployments

| Network      | Status     | Notes         |
| ------------ | ---------- | ------------- |
| Rise Mainnet | 🔜 Planned | Pending audit |
