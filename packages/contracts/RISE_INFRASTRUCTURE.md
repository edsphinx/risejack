# Rise Chain Infrastructure Documentation

Reference for Rise Testnet contract addresses and planned feature integrations.

## Pre-deployed Contracts (Rise Testnet)

### Core Infrastructure

| Contract                | Address                                      | Use Case                     |
| ----------------------- | -------------------------------------------- | ---------------------------- |
| **WETH**                | `0x4200000000000000000000000000000000000006` | Wrapped ETH for DeFi         |
| **Permit2**             | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Gasless token approvals      |
| **MultiCall3**          | `0xcA11bde05977b3631167028862bE2a173976CA11` | Batch transactions           |
| **EntryPoint (v0.7.0)** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ERC-4337 Account Abstraction |
| **Create2Deployer**     | `0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2` | Deterministic deployments    |
| **GnosisSafe**          | `0x69f4D1788e39c87893C980c06EdF4b7f686e2938` | Multisig wallet              |

### Price Oracles

| Ticker | Oracle Address                               | Decimals |
| ------ | -------------------------------------------- | -------- |
| ETH    | `0x7114E2537851e727678DE5a96C8eE5d0Ca14f03D` | 8        |
| USDC   | `0x50524C5bDa18aE25C600a8b81449B9CeAeB50471` | 8        |
| USDT   | `0x9190159b1bb78482Dca6EBaDf03ab744de0c0197` | 8        |
| BTC    | `0xadDAEd879D549E5DBfaf3e35470C20D8C50fDed0` | 8        |

### L2 System Contracts

| Contract               | Address                                      | Description              |
| ---------------------- | -------------------------------------------- | ------------------------ |
| L2StandardBridge       | `0x4200000000000000000000000000000000000010` | Bridge tokens to/from L1 |
| L2CrossDomainMessenger | `0x4200000000000000000000000000000000000007` | L2→L1 messaging          |
| GasPriceOracle         | `0x420000000000000000000000000000000000000F` | Gas price info           |
| EAS                    | `0x4200000000000000000000000000000000000021` | Attestation Service      |

---

## Feature Roadmap

### Phase 1: Core Token Infrastructure ✅

- [x] CHIPToken with contractURI (ERC-7572)
- [x] Multi-asset CHIPWrapper with oracle pricing
- [ ] Deploy updated contracts

### Phase 2: Gasless Approvals with Permit2

**Priority: HIGH**

Replace current approval flow with Permit2 for better UX:

```solidity
// Current flow (requires separate approval tx)
chip.approve(casino, amount);
casino.play(...);

// Permit2 flow (single signed message)
permit2.permitTransferFrom(signedPermit, transferDetails, owner, signature);
```

**Benefits:**

- No approval transaction needed
- Signed off-chain, executed on-chain
- Revocable allowances
- Already deployed on Rise Testnet

**Files to modify:**

- `VyreCasino.sol` - Add Permit2 support
- `CHIPWrapper.sol` - Add permitDeposit()
- Frontend approval modal → Use signature instead of tx

### Phase 3: Batch Transactions with MultiCall3

**Priority: MEDIUM**

Bundle multiple operations:

```solidity
// Example: Approve + Play in single tx
multicall.aggregate([
    abi.encodeCall(chip.approve, (casino, amount)),
    abi.encodeCall(casino.play, (game, token, betAmount, data))
]);
```

**Use cases:**

- Approve + Bet in one click
- Claim multiple rewards
- Batch game actions

### Phase 4: Cross-Chain Bridge Integration

**Priority: LOW (Future)**

Enable bridging assets from Ethereum L1:

```solidity
// L1 → Rise Testnet
IL1StandardBridge(0xe9a531...610).depositETH{value: amount}(minGas, "");

// Rise Testnet → L1 (7 day delay)
IL2ToL1MessagePasser(0x4200...0016).initiateWithdrawal(target, value, data, minGas);
```

**Use cases:**

- Onboard users from Ethereum mainnet
- Bridge USDC/WETH from L1
- Future mainnet deployment

### Phase 5: EAS Attestations

**Priority: LOW (Future)**

Use Ethereum Attestation Service for:

- Game result verification
- Player reputation scores
- Achievement badges
- KYC attestations (if needed)

---

## Implementation Priority

| Phase  | Feature                     | Effort | Impact |
| ------ | --------------------------- | ------ | ------ |
| **P1** | Deploy updated CHIP/Wrapper | Low    | High   |
| **P2** | Permit2 gasless approvals   | Medium | High   |
| **P3** | MultiCall3 batching         | Medium | Medium |
| **P4** | L1 Bridge                   | High   | Medium |
| **P5** | EAS Attestations            | Medium | Low    |

---

## Notes

### Oracle Usage

```solidity
interface IPriceOracle {
    function latest_answer() external view returns (int256);
}

// Get ETH price (8 decimals)
int256 ethPrice = IPriceOracle(0x7114...f03D).latest_answer();
// e.g., 330000000000 = $3,300.00
```

### WETH Address

Standard OP Stack WETH at `0x4200000000000000000000000000000000000006`
Same as Optimism/Base/other OP chains.
