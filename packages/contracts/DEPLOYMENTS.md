# RiseJack Deployment Changelog

## Rise Testnet

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
