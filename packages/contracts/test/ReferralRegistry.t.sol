// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { ReferralRegistry } from "../src/registries/ReferralRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Mock Treasury that tracks payouts
contract MockTreasury {
    mapping(address => mapping(address => uint256)) public payouts;

    function payout(
        address to,
        address token,
        uint256 amount
    ) external {
        payouts[to][token] += amount;
    }

    function getPayout(
        address to,
        address token
    ) external view returns (uint256) {
        return payouts[to][token];
    }
}

/**
 * @title ReferralRegistry Test Suite
 * @notice Comprehensive tests for multi-tier referral system
 */
contract ReferralRegistryTest is Test {
    ReferralRegistry registry;
    MockTreasury treasury;

    address owner = address(this);
    address game = address(0x1);
    address token = address(0x7777);

    address alice = address(0x100);
    address bob = address(0x200);
    address charlie = address(0x300);
    address dave = address(0x400);

    function setUp() public {
        treasury = new MockTreasury();
        registry = new ReferralRegistry(owner, address(treasury));
        registry.authorizeCaller(game);

        vm.label(address(registry), "ReferralRegistry");
        vm.label(address(treasury), "Treasury");
        vm.label(alice, "Alice");
        vm.label(bob, "Bob");
        vm.label(charlie, "Charlie");
        vm.label(dave, "Dave");
    }

    // ==================== DEPLOYMENT ====================

    function test_Deployment() public view {
        assertEq(registry.owner(), owner);
        assertEq(address(registry.treasury()), address(treasury));
        assertTrue(registry.authorizedCallers(game));
        assertEq(registry.directShareBps(), 5000);
        assertEq(registry.indirectShareBps(), 1000);
        assertFalse(registry.selfReferralAllowed());
    }

    function test_ConstructorZeroOwner() public {
        vm.expectRevert("ReferralRegistry: zero owner");
        new ReferralRegistry(address(0), address(treasury));
    }

    function test_ConstructorZeroTreasury() public {
        vm.expectRevert("ReferralRegistry: zero treasury");
        new ReferralRegistry(owner, address(0));
    }

    // ==================== SET REFERRER ====================

    function test_SetReferrer() public {
        vm.prank(bob);
        registry.setReferrer(alice);

        assertTrue(registry.hasReferrer(bob));
        assertEq(registry.referrers(bob), alice);
        assertEq(registry.totalReferred(alice), 1);
    }

    function test_SetReferrerAlreadySet() public {
        vm.prank(bob);
        registry.setReferrer(alice);

        vm.prank(bob);
        vm.expectRevert("ReferralRegistry: referrer already set");
        registry.setReferrer(charlie);
    }

    function test_SetReferrerZeroAddress() public {
        vm.prank(bob);
        vm.expectRevert("ReferralRegistry: zero referrer");
        registry.setReferrer(address(0));
    }

    function test_SetReferrerSelfNotAllowed() public {
        vm.prank(bob);
        vm.expectRevert("ReferralRegistry: self referral");
        registry.setReferrer(bob);
    }

    function test_SetReferrerSelfAllowed() public {
        registry.setSelfReferralAllowed(true);

        vm.prank(bob);
        registry.setReferrer(bob);

        assertEq(registry.referrers(bob), bob);
    }

    // ==================== RECORD EARNINGS ====================

    function test_RecordEarningsDirectOnly() public {
        // Bob is referred by Alice
        vm.prank(bob);
        registry.setReferrer(alice);

        // Bob plays, 100 house edge
        vm.prank(game);
        registry.recordEarnings(bob, token, 100, 1000);

        // Alice gets 50% = 50
        assertEq(registry.earnings(alice, token), 50);
    }

    function test_RecordEarningsMultiTier() public {
        // Alice refers Bob, Bob refers Charlie
        vm.prank(bob);
        registry.setReferrer(alice);

        vm.prank(charlie);
        registry.setReferrer(bob);

        // Charlie plays, 1000 house edge
        vm.prank(game);
        registry.recordEarnings(charlie, token, 1000, 10_000);

        // Bob (level 1) gets 50% = 500
        assertEq(registry.earnings(bob, token), 500);

        // Alice (level 2) gets 10% = 100
        assertEq(registry.earnings(alice, token), 100);
    }

    function test_RecordEarningsNoReferrer() public {
        // Bob has no referrer - should not revert, just skip
        vm.prank(game);
        registry.recordEarnings(bob, token, 100, 1000);

        // No earnings recorded
        assertEq(registry.earnings(alice, token), 0);
    }

    function test_RecordEarningsNotAuthorized() public {
        vm.prank(bob);
        vm.expectRevert("ReferralRegistry: not authorized");
        registry.recordEarnings(charlie, token, 100, 1000);
    }

    function test_RecordEarningsVolumeTracking() public {
        vm.prank(bob);
        registry.setReferrer(alice);

        vm.prank(game);
        registry.recordEarnings(bob, token, 100, 5000);

        assertEq(registry.referralVolume(alice, token), 5000);
    }

    // ==================== CLAIM EARNINGS ====================

    function test_ClaimEarnings() public {
        // Setup referral
        vm.prank(bob);
        registry.setReferrer(alice);

        // Generate earnings
        vm.prank(game);
        registry.recordEarnings(bob, token, 1000, 10_000);

        // Alice claims
        vm.prank(alice);
        registry.claimEarnings(token);

        // Check treasury received payout request
        assertEq(treasury.getPayout(alice, token), 500);

        // Check earnings cleared
        assertEq(registry.earnings(alice, token), 0);
        assertEq(registry.claimedEarnings(alice, token), 500);
    }

    function test_ClaimEarningsNoEarnings() public {
        vm.prank(alice);
        vm.expectRevert("ReferralRegistry: no earnings");
        registry.claimEarnings(token);
    }

    // ==================== VIEW FUNCTIONS ====================

    function test_GetReferralTree() public {
        vm.prank(bob);
        registry.setReferrer(alice);

        vm.prank(charlie);
        registry.setReferrer(bob);

        (address level1, address level2) = registry.getReferralTree(charlie);
        assertEq(level1, bob);
        assertEq(level2, alice);
    }

    function test_GetReferrerStats() public {
        vm.prank(bob);
        registry.setReferrer(alice);

        vm.prank(game);
        registry.recordEarnings(bob, token, 1000, 10_000);

        (uint256 referred, uint256 volume, uint256 earned, uint256 pending) =
            registry.getReferrerStats(alice, token);

        assertEq(referred, 1);
        assertEq(volume, 10_000);
        assertEq(earned, 0);
        assertEq(pending, 500);
    }

    function test_PendingEarnings() public {
        vm.prank(bob);
        registry.setReferrer(alice);

        vm.prank(game);
        registry.recordEarnings(bob, token, 200, 2000);

        assertEq(registry.pendingEarnings(alice, token), 100);
    }

    // ==================== ADMIN ====================

    function test_AuthorizeCaller() public {
        address newGame = address(0x999);
        registry.authorizeCaller(newGame);
        assertTrue(registry.authorizedCallers(newGame));
    }

    function test_AuthorizeCallerOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert("ReferralRegistry: only owner");
        registry.authorizeCaller(address(0x999));
    }

    function test_AuthorizeCallerZeroAddress() public {
        vm.expectRevert("ReferralRegistry: zero caller");
        registry.authorizeCaller(address(0));
    }

    function test_RevokeCaller() public {
        registry.revokeCaller(game);
        assertFalse(registry.authorizedCallers(game));
    }

    function test_SetShares() public {
        registry.setShares(6000, 2000);
        assertEq(registry.directShareBps(), 6000);
        assertEq(registry.indirectShareBps(), 2000);
    }

    function test_SetSharesExceed100() public {
        vm.expectRevert("ReferralRegistry: shares exceed 100%");
        registry.setShares(9000, 2000);
    }

    function test_SetSharesOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert("ReferralRegistry: only owner");
        registry.setShares(6000, 2000);
    }

    function test_SetTreasury() public {
        address newTreasury = address(0x9999);
        registry.setTreasury(newTreasury);
        assertEq(address(registry.treasury()), newTreasury);
    }

    function test_SetTreasuryZeroAddress() public {
        vm.expectRevert("ReferralRegistry: zero treasury");
        registry.setTreasury(address(0));
    }

    function test_TransferOwnership() public {
        registry.transferOwnership(alice);
        assertEq(registry.owner(), alice);
    }

    function test_TransferOwnershipZeroAddress() public {
        vm.expectRevert("ReferralRegistry: zero owner");
        registry.transferOwnership(address(0));
    }

    // ==================== FUZZ TESTS ====================

    function testFuzz_RecordEarnings(
        uint256 houseEdge
    ) public {
        houseEdge = bound(houseEdge, 0, 10_000_000e18);

        vm.prank(bob);
        registry.setReferrer(alice);

        vm.prank(game);
        registry.recordEarnings(bob, token, houseEdge, houseEdge * 10);

        uint256 expected = (houseEdge * 5000) / 10_000;
        assertEq(registry.earnings(alice, token), expected);
    }
}
