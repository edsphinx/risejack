# Vyre Contracts - Code Conventions

> **MANDATORY**: All Vyre contracts MUST follow these conventions.

## Contract Documentation Style

Every contract MUST include:

### 1. Header Block (ASCII Box)

```solidity
/* --------------------------------------------------------------------------
 * CONTRACT_NAME — SHORT DESCRIPTION
 * -------------------------------------------------------------------------
 * Detailed description of what the contract does.
 *
 * - Key Feature 1: Brief explanation
 * - Key Feature 2: Brief explanation
 * - Security: Security considerations
 * ------------------------------------------------------------------------*/
```

### 2. Contract NatSpec

```solidity
/**
 * @title  ContractName
 * @author edsphinx
 * @custom:company Blocketh
 * @notice User-facing description of what the contract does.
 * @dev    Technical implementation details, architecture notes,
 *         security considerations, and integration patterns.
 */
```

### 3. Section Headers

Use consistent section dividers:

```solidity
// ----------------------------------------------------------------------
//  SECTION_NAME
// ----------------------------------------------------------------------

// For special sections (Events, Constructor):
// ----------------------------------------------------------------------
// ░░  EVENTS
// ----------------------------------------------------------------------
```

### 4. Variable/Function Documentation

Every public/external item needs `@notice`:

```solidity
/// @notice Description of what this variable holds
uint256 public someVariable;

/**
 * @notice What this function does.
 * @param paramName Description of parameter.
 * @return What the function returns.
 * @custom:security onlyOwner (if applicable)
 */
function someFunction(uint256 paramName) external returns (uint256) { }
```

### 5. Modifier Documentation

```solidity
/// @dev Restricts function to contract owner
modifier onlyOwner() { }
```

## Section Order

1. SPDX License
2. pragma
3. Header Block (ASCII box)
4. Imports
5. Contract NatSpec
6. Contract declaration
7. CONSTANTS
8. STORAGE (state variables)
9. STRUCTS
10. ENUMS
11. EVENTS
12. MODIFIERS
13. CONSTRUCTOR
14. EXTERNAL FUNCTIONS
15. PUBLIC FUNCTIONS
16. INTERNAL FUNCTIONS
17. PRIVATE FUNCTIONS
18. VIEW FUNCTIONS
19. ADMIN FUNCTIONS

## Test Documentation

Tests MUST include:

```solidity
/**
 * @title ContractNameTest
 * @notice Tests for ContractName
 */
contract ContractNameTest is Test {
    // ==================== SETUP ====================

    // ==================== BASIC TESTS ====================

    // ==================== EDGE CASES ====================

    // ==================== ADMIN TESTS ====================
}
```

## Contracts to Document

### Core Architecture

- [ ] VyreCasino.sol
- [x] VyreJackV2.sol ✅
- [ ] VyreTreasury.sol
- [ ] IVyreGame.sol

### Registries

- [ ] ReferralRegistry.sol
- [ ] XPRegistry.sol

### DeFi

- [ ] VyreStaking.sol (Synthetix fork - minimal docs needed)
- [ ] CHIPToken.sol
- [ ] CHIPWrapper.sol

### Vaults

- [ ] TableVault.sol
- [ ] TokenFactory.sol

### Legacy (Low Priority)

- [ ] VyreJackETH.sol
- [ ] VyreJackERC20.sol
