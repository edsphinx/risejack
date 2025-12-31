# Security Model

## Smart Contract Security

| Measure                   | Implementation                                                  |
| ------------------------- | --------------------------------------------------------------- |
| Commit-Reveal Randomness  | Prevents front-running and manipulation of card draws           |
| State Machine Enforcement | Each game action validated against current state                |
| Reentrancy Protection     | State changes before external calls                             |
| Bet Limits                | Configurable min/max bet amounts                                |
| Access Control            | Admin functions protected (to be implemented with OpenZeppelin) |

## Session Key Security

| Measure            | Implementation                                                  |
| ------------------ | --------------------------------------------------------------- |
| P256 Cryptography  | WebAuthn-compatible elliptic curve signing                      |
| Time-Bounded Keys  | Session keys expire after configured duration (default: 1 hour) |
| Permission Scoping | Keys can only call whitelisted contract functions               |
| Spend Limits       | Configurable maximum spend per time period                      |
| Local Key Storage  | Private keys never leave the client device                      |
| Auth Fallback      | Automatic passkey fallback if session key fails                 |

## Permitted Contract Calls

Session keys are restricted to the following functions only:

- `placeBet(bytes32)` - Start a new game
- `hit()` - Request another card
- `stand()` - End player turn
- `double()` - Double down
- `surrender()` - Forfeit half the bet

## Randomness Guarantees

The Rise VRF (Verifiable Random Function) ensures:

1. **Unpredictability**: Randomness generated after player commits to action
2. **Unbiasability**: Neither party can influence the outcome
3. **Verifiability**: All randomness proofs are on-chain and auditable
4. **Timeout Protection**: Games can be cancelled after 5 minutes if VRF fails

## Mobile Wallet Support

The frontend includes a WebAuthn polyfill for enhanced mobile compatibility:

| Feature              | Implementation                                         |
| -------------------- | ------------------------------------------------------ |
| CSP Compliant        | Polyfill loaded as external TypeScript module          |
| Minimal Interference | Only modifies requests with missing `pubKeyCredParams` |
| Algorithm Support    | Ensures ES256 (-7) and RS256 (-257) are available      |
| Graceful Fallback    | Falls back to original behavior on any error           |
| Firefox/Mobile Fix   | Fixes "publicKey.pubKeyCredParams is missing" error    |

## Production Logging

The application uses an environment-aware logging system to prevent sensitive data exposure:

| Environment | `logger.log` | `logger.warn` | `logger.error` |
| ----------- | ------------ | ------------- | -------------- |
| Development | ✅ Outputs   | ✅ Outputs    | ✅ Outputs     |
| Production  | ❌ Silent    | ❌ Silent     | ✅ Outputs     |

This ensures:

- **No debug logs in production** - Session keys, public keys, and internal state are not exposed
- **Errors always logged** - Critical issues are still captured for monitoring
- **Simple API** - Import `logger` from `@/lib/logger` instead of `console`

## Security Testing

| Tool               | Purpose                | Status           |
| ------------------ | ---------------------- | ---------------- |
| Slither            | Static analysis        | ✅ Configured    |
| Foundry Invariants | Property-based testing | ✅ 13 invariants |
| Foundry Fuzz       | Input fuzzing          | ✅ Integrated    |
| Medusa             | Deep fuzzing           | ✅ Configured    |

**Test Commands:**

```bash
cd packages/contracts
bun run test:defi         # Unit tests (89 passing)
bun run test:invariant    # K invariant, solvency
bun run test:fork         # Rise testnet fork
bun run slither           # Static analysis
```
