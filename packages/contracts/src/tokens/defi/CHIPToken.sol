// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.25;

/* --------------------------------------------------------------------------
 * CHIPTOKEN — NATIVE GAMING CURRENCY OF VYRECASINO
 * -------------------------------------------------------------------------
 * The primary ERC20 token for all gaming operations on VyreCasino.
 *
 * - Standard ERC20 with 18 decimals
 * - Burnable for deflationary mechanics
 * - Permit for gasless approvals (EIP-2612)
 * - ERC-7572 contractURI for wallet icon integration
 * - Owner-only minting (controlled by CHIPWrapper)
 * ------------------------------------------------------------------------*/

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  CHIPToken
 * @author edsphinx
 * @custom:company Blocketh
 * @notice The native gaming currency of VyreCasino ecosystem.
 * @dev    CHIP is pegged 1:1 to USD via CHIPWrapper.
 *         Users deposit USDC/ETH/other assets → receive CHIP for gaming.
 *         CHIP can be withdrawn back to USDC at 1:1 (minus 0.5% fee).
 *
 *         Security Model:
 *         - Only owner (CHIPWrapper) can mint/burn
 *         - 1 billion initial supply for liquidity bootstrapping
 *         - Supports EIP-2612 permit for gasless approvals
 */
contract CHIPToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    constructor(
        address initialOwner
    ) ERC20("Vyre Chip", "CHIP") ERC20Permit("Vyre Chip") Ownable(initialOwner) {
        // Initial supply to owner for liquidity pools
        _mint(initialOwner, 1_000_000_000 * 10 ** decimals()); // 1 Billion start
    }

    /**
     * @dev Mint new tokens. Only callable by owner (CHIPWrapper).
     */
    function mint(
        address to,
        uint256 amount
    ) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens from address. Only callable by owner (CHIPWrapper).
     * Used when users withdraw CHIP for USDC.
     */
    function burn(
        address from,
        uint256 amount
    ) public onlyOwner {
        _burn(from, amount);
    }

    /**
     * @dev Returns URI for contract-level metadata (ERC-7572).
     * Includes token name, symbol, decimals, description, and image URL.
     * Used by wallets to display token icon and info.
     */
    function contractURI() external pure returns (string memory) {
        return "https://vyre.top/tokens/chip.json";
    }
}
