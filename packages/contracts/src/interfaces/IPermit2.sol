// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IPermit2
 * @notice Interface for Uniswap's Permit2 contract
 * @dev Pre-deployed on Rise Testnet at 0x000000000022D473030F116dDEE9F6B43aC78BA3
 *
 * Permit2 enables gasless token approvals via signed messages.
 * Users sign a permit off-chain, and contracts can pull tokens using that signature.
 */
interface IPermit2 {
    /// @notice Token and amount in a permit message
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    /// @notice The permit data for a single token
    struct PermitSingle {
        TokenPermissions details;
        address spender;
        uint256 sigDeadline;
    }

    /// @notice A mapping from token to spender to allowance
    struct PackedAllowance {
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    /// @notice Details for a transfer
    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    /// @notice The permit message signed by the owner
    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    /**
     * @notice Transfer tokens using a signed permit
     * @param permit The permit data signed by the owner
     * @param transferDetails The transfer recipient and amount
     * @param owner The owner of the tokens to transfer
     * @param signature The owner's signature over the permit data
     */
    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    /**
     * @notice Get the allowance for a token/spender pair
     * @param owner The owner of the tokens
     * @param token The token address
     * @param spender The spender address
     * @return The packed allowance data
     */
    function allowance(
        address owner,
        address token,
        address spender
    ) external view returns (uint160, uint48, uint48);
}
