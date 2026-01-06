// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { LPVesting } from "../src/vaults/LPVesting.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock LP Token
contract MockLP is ERC20 {
    constructor() ERC20("LP Token", "LP") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(
        address to,
        uint256 amount
    ) external {
        _mint(to, amount);
    }
}

/**
 * @title LPVesting Test Suite
 * @notice Tests for LP token vesting with 6-month cliff
 */
contract LPVestingTest is Test {
    LPVesting vesting;
    MockLP lp;

    address owner = address(this);
    address locker = address(0x1);
    address beneficiary = address(0x2);

    function setUp() public {
        vesting = new LPVesting(owner);
        lp = new MockLP();

        vesting.authorizeLocker(locker);

        // Give LP tokens to locker
        lp.mint(locker, 100_000e18);

        vm.prank(locker);
        lp.approve(address(vesting), type(uint256).max);

        vm.label(address(vesting), "LPVesting");
        vm.label(locker, "Locker");
        vm.label(beneficiary, "Beneficiary");
    }

    // ==================== DEPLOYMENT ====================

    function test_Deployment() public view {
        assertEq(vesting.owner(), owner);
        assertTrue(vesting.authorizedLockers(locker));
        assertEq(vesting.CLIFF_DURATION(), 180 days);
        assertEq(vesting.VESTING_DURATION(), 180 days);
    }

    function test_ConstructorZeroOwner() public {
        vm.expectRevert("LPVesting: zero owner");
        new LPVesting(address(0));
    }

    // ==================== LOCK LP ====================

    function test_LockLP() public {
        vm.prank(locker);
        vesting.lockLP(address(lp), 10_000e18, beneficiary);

        // Check vesting exists
        (,,,, uint256 startTime, bool exists) = vesting.vestings(address(lp), beneficiary);
        assertTrue(exists);
        assertGt(startTime, 0);
    }

    function test_LockLPZeroToken() public {
        vm.prank(locker);
        vm.expectRevert("LPVesting: zero lpToken");
        vesting.lockLP(address(0), 10_000e18, beneficiary);
    }

    function test_LockLPZeroBeneficiary() public {
        vm.prank(locker);
        vm.expectRevert("LPVesting: zero beneficiary");
        vesting.lockLP(address(lp), 10_000e18, address(0));
    }

    function test_LockLPZeroAmount() public {
        vm.prank(locker);
        vm.expectRevert("LPVesting: zero amount");
        vesting.lockLP(address(lp), 0, beneficiary);
    }

    function test_LockLPNotAuthorized() public {
        vm.prank(beneficiary);
        vm.expectRevert("LPVesting: not authorized");
        vesting.lockLP(address(lp), 10_000e18, beneficiary);
    }

    // ==================== VESTING ====================

    function test_VestingDuringCliff() public {
        vm.prank(locker);
        vesting.lockLP(address(lp), 10_000e18, beneficiary);

        // 3 months into cliff
        vm.warp(block.timestamp + 90 days);

        uint256 vested = vesting.getVestedAmount(address(lp), beneficiary);
        assertEq(vested, 0);
    }

    function test_VestingAfterCliff() public {
        vm.prank(locker);
        vesting.lockLP(address(lp), 10_000e18, beneficiary);

        // 7 months - past cliff
        vm.warp(block.timestamp + 210 days);

        uint256 vested = vesting.getVestedAmount(address(lp), beneficiary);
        assertGt(vested, 0);
        assertLt(vested, 10_000e18);
    }

    function test_VestingFullyVested() public {
        vm.prank(locker);
        vesting.lockLP(address(lp), 10_000e18, beneficiary);

        // 12+ months
        vm.warp(block.timestamp + 400 days);

        uint256 vested = vesting.getVestedAmount(address(lp), beneficiary);
        assertEq(vested, 10_000e18);
    }

    // ==================== CLAIM ====================

    function test_ClaimAfterVesting() public {
        vm.prank(locker);
        vesting.lockLP(address(lp), 10_000e18, beneficiary);

        // Full vesting
        vm.warp(block.timestamp + 400 days);

        vm.prank(beneficiary);
        vesting.claim(address(lp));

        assertEq(lp.balanceOf(beneficiary), 10_000e18);
    }

    function test_ClaimNoVesting() public {
        vm.prank(beneficiary);
        vm.expectRevert("LPVesting: no vesting");
        vesting.claim(address(lp));
    }

    function test_ClaimNothingClaimable() public {
        vm.prank(locker);
        vesting.lockLP(address(lp), 10_000e18, beneficiary);

        // During cliff
        vm.warp(block.timestamp + 90 days);

        vm.prank(beneficiary);
        vm.expectRevert("LPVesting: nothing to claim");
        vesting.claim(address(lp));
    }

    // ==================== ADMIN ====================

    function test_AuthorizeLocker() public {
        address newLocker = address(0x999);
        vesting.authorizeLocker(newLocker);
        assertTrue(vesting.authorizedLockers(newLocker));
    }

    function test_AuthorizeLockerOnlyOwner() public {
        vm.prank(beneficiary);
        vm.expectRevert("LPVesting: only owner");
        vesting.authorizeLocker(address(0x999));
    }

    function test_RevokeLocker() public {
        vesting.revokeLocker(locker);
        assertFalse(vesting.authorizedLockers(locker));
    }

    function test_TransferOwnership() public {
        vesting.transferOwnership(beneficiary);
        assertEq(vesting.owner(), beneficiary);
    }

    function test_TransferOwnershipZeroAddress() public {
        vm.expectRevert("LPVesting: zero owner");
        vesting.transferOwnership(address(0));
    }
}
