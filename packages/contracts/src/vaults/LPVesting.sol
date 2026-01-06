// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.28;

/* --------------------------------------------------------------------------
 * LPVESTING — LP TOKEN VESTING WITH CLIFF
 * -------------------------------------------------------------------------
 * Locks LP tokens with 6-month cliff + 6-month linear vesting.
 *
 * - Cliff: 100% locked for first 6 months
 * - Vesting: Linear unlock over next 6 months
 * - Anti-Rug: Prevents immediate LP dumps after bonding curve graduation
 * ------------------------------------------------------------------------*/

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  LPVesting
 * @author edsphinx
 * @custom:company Blocketh
 * @notice Locks LP tokens with 6 month cliff + 6 month linear vesting
 * @dev Used by BondingCurve to lock graduated LP tokens
 *
 * SCHEDULE:
 * Month 0-6:  100% locked (cliff)
 * Month 7:    20% unlocked
 * Month 8:    40% unlocked
 * Month 9:    60% unlocked
 * Month 10:   80% unlocked
 * Month 11+:  100% unlocked
 */
contract LPVesting is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== STATE ====================

    struct VestingInfo {
        address lpToken;
        address beneficiary;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        bool exists;
    }

    /// @notice Vesting info by LP token and beneficiary
    mapping(address => mapping(address => VestingInfo)) public vestings;

    /// @notice Authorized lockers (BondingCurve, TokenFactory)
    mapping(address => bool) public authorizedLockers;

    /// @notice Owner
    address public owner;

    /// @notice Cliff duration (6 months)
    uint256 public constant CLIFF_DURATION = 180 days;

    /// @notice Vesting duration after cliff (6 months)
    uint256 public constant VESTING_DURATION = 180 days;

    // ==================== EVENTS ====================

    event LPLocked(
        address indexed lpToken,
        address indexed beneficiary,
        uint256 amount,
        uint256 unlockStart,
        uint256 vestingEnd
    );

    event LPClaimed(address indexed lpToken, address indexed beneficiary, uint256 amount);

    event LockerAuthorized(address indexed locker);
    event LockerRevoked(address indexed locker);

    // ==================== MODIFIERS ====================

    modifier onlyOwner() {
        require(msg.sender == owner, "LPVesting: only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedLockers[msg.sender], "LPVesting: not authorized");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _owner
    ) {
        require(_owner != address(0), "LPVesting: zero owner");
        owner = _owner;
    }

    // ==================== LOCK FUNCTION ====================

    /**
     * @notice Lock LP tokens for beneficiary
     * @param lpToken LP token address
     * @param amount Amount to lock
     * @param beneficiary Who receives vested tokens
     */
    function lockLP(
        address lpToken,
        uint256 amount,
        address beneficiary
    ) external onlyAuthorized nonReentrant {
        require(lpToken != address(0), "LPVesting: zero lpToken");
        require(beneficiary != address(0), "LPVesting: zero beneficiary");
        require(amount > 0, "LPVesting: zero amount");

        VestingInfo storage vesting = vestings[lpToken][beneficiary];

        if (vesting.exists) {
            // Add to existing vesting
            vesting.totalAmount += amount;
        } else {
            // Create new vesting
            vestings[lpToken][beneficiary] = VestingInfo({
                lpToken: lpToken,
                beneficiary: beneficiary,
                totalAmount: amount,
                claimedAmount: 0,
                startTime: block.timestamp,
                exists: true
            });
        }

        // Transfer LP to this contract
        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        emit LPLocked(
            lpToken,
            beneficiary,
            amount,
            block.timestamp + CLIFF_DURATION,
            block.timestamp + CLIFF_DURATION + VESTING_DURATION
        );
    }

    // ==================== CLAIM FUNCTION ====================

    /**
     * @notice Claim vested LP tokens
     * @param lpToken LP token to claim
     */
    function claim(
        address lpToken
    ) external nonReentrant {
        VestingInfo storage vesting = vestings[lpToken][msg.sender];
        require(vesting.exists, "LPVesting: no vesting");

        uint256 claimable = getClaimableAmount(lpToken, msg.sender);
        require(claimable > 0, "LPVesting: nothing to claim");

        vesting.claimedAmount += claimable;

        IERC20(lpToken).safeTransfer(msg.sender, claimable);

        emit LPClaimed(lpToken, msg.sender, claimable);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get claimable amount for beneficiary
     */
    function getClaimableAmount(
        address lpToken,
        address beneficiary
    ) public view returns (uint256) {
        VestingInfo storage vesting = vestings[lpToken][beneficiary];
        if (!vesting.exists) return 0;

        uint256 vested = getVestedAmount(lpToken, beneficiary);
        return vested > vesting.claimedAmount ? vested - vesting.claimedAmount : 0;
    }

    /**
     * @notice Get total vested amount (including claimed)
     */
    function getVestedAmount(
        address lpToken,
        address beneficiary
    ) public view returns (uint256) {
        VestingInfo storage vesting = vestings[lpToken][beneficiary];
        if (!vesting.exists) return 0;

        uint256 elapsed = block.timestamp - vesting.startTime;

        // Before cliff: nothing vested
        if (elapsed < CLIFF_DURATION) {
            return 0;
        }

        // After cliff + full vesting: everything vested
        if (elapsed >= CLIFF_DURATION + VESTING_DURATION) {
            return vesting.totalAmount;
        }

        // During vesting: linear unlock
        uint256 vestingElapsed = elapsed - CLIFF_DURATION;
        return (vesting.totalAmount * vestingElapsed) / VESTING_DURATION;
    }

    /**
     * @notice Get vesting schedule info
     */
    function getVestingSchedule(
        address lpToken,
        address beneficiary
    )
        external
        view
        returns (
            uint256 total,
            uint256 claimed,
            uint256 claimable,
            uint256 cliffEnd,
            uint256 vestingEnd,
            bool isCliffPassed
        )
    {
        VestingInfo storage vesting = vestings[lpToken][beneficiary];
        if (!vesting.exists) return (0, 0, 0, 0, 0, false);

        total = vesting.totalAmount;
        claimed = vesting.claimedAmount;
        claimable = getClaimableAmount(lpToken, beneficiary);
        cliffEnd = vesting.startTime + CLIFF_DURATION;
        vestingEnd = vesting.startTime + CLIFF_DURATION + VESTING_DURATION;
        isCliffPassed = block.timestamp >= cliffEnd;
    }

    /**
     * @notice Check if LP is locked (still in cliff or vesting)
     */
    function isLocked(
        address lpToken,
        address beneficiary
    ) external view returns (bool) {
        VestingInfo storage vesting = vestings[lpToken][beneficiary];
        if (!vesting.exists) return false;
        return vesting.claimedAmount < vesting.totalAmount;
    }

    // ==================== ADMIN ====================

    function authorizeLocker(
        address locker
    ) external onlyOwner {
        require(locker != address(0), "LPVesting: zero locker");
        authorizedLockers[locker] = true;
        emit LockerAuthorized(locker);
    }

    function revokeLocker(
        address locker
    ) external onlyOwner {
        authorizedLockers[locker] = false;
        emit LockerRevoked(locker);
    }

    function transferOwnership(
        address newOwner
    ) external onlyOwner {
        require(newOwner != address(0), "LPVesting: zero owner");
        owner = newOwner;
    }
}
