# RiseJack Deployment Changelog

## Rise Testnet

### v1.0.0 - 2024-12-29

**Contract:** RiseJack  
**Address:** [`0x8a0AaDE6ebDaEF9993084a29a46BD1C93eC6001a`](https://explorer.testnet.riselabs.xyz/address/0x8a0aade6ebdaef9993084a29a46bd1c93ec6001a)  
**Chain ID:** 11155931  
**TX Hash:** `0x38dde0765b7e96f805d2d9806ee1a3e4d8ac5e7cb5b18e7e50103486ff078bf0`  
**Block:** [View on Explorer](https://explorer.testnet.riselabs.xyz/tx/0x38dde0765b7e96f805d2d9806ee1a3e4d8ac5e7cb5b18e7e50103486ff078bf0)  
**Gas Used:** 4,231,195 gas (~0.0000000015 ETH)  
**Verified:** ✅ Blockscout  

#### Configuration

| Parameter | Value |
|-----------|-------|
| VRF Coordinator | `0x9d57aB4517ba97349551C876a01a7580B1338909` |
| Min Bet | 0.001 ETH |
| Max Bet | 1 ETH |
| Blackjack Payout | 3:2 (150%) |
| Game Timeout | 1 hour |
| VRF Timeout | 5 minutes |
| Game Cooldown | 30 seconds |

#### Features Deployed

- ✅ Core gameplay (hit, stand, double, surrender)
- ✅ Rise VRF integration for provably fair randomness
- ✅ House protection (daily limits, circuit breaker, reserve requirements)
- ✅ Timeout handling (game timeout, VRF retry)
- ✅ Admin functions (pause, force resolve, withdraw)
- ✅ Rate limiting (30 second cooldown)

#### Security Fixes Included

- VRF coordinator contract validation in constructor
- Double down exposure tracking correction
- Cooldown modifier parameter consistency

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

| Network | Status | Notes |
|---------|--------|-------|
| Rise Mainnet | 🔜 Planned | Pending audit |
