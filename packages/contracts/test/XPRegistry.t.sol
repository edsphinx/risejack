// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { XPRegistry } from "../src/registries/XPRegistry.sol";

/**
 * @title XPRegistry Test Suite
 * @notice Comprehensive tests for player XP and level tracking
 */
contract XPRegistryTest is Test {
    XPRegistry registry;

    address owner = address(this);
    address game = address(0x1);
    address player1 = address(0x2);
    address player2 = address(0x3);

    function setUp() public {
        registry = new XPRegistry(owner);
        registry.authorizeCaller(game);

        vm.label(address(registry), "XPRegistry");
        vm.label(game, "Game");
        vm.label(player1, "Player1");
        vm.label(player2, "Player2");
    }

    // ==================== DEPLOYMENT ====================

    function test_Deployment() public view {
        assertEq(registry.owner(), owner);
        assertTrue(registry.authorizedCallers(game));
        assertEq(registry.CASINO_OWNER_XP(), 100_000);
    }

    function test_ConstructorZeroOwner() public {
        vm.expectRevert("XPRegistry: zero owner");
        new XPRegistry(address(0));
    }

    // ==================== ADD XP ====================

    function test_AddXP() public {
        vm.prank(game);
        registry.addXP(player1, 1000);

        assertEq(registry.getXP(player1), 1000);
        assertEq(registry.getLevel(player1), 10);
    }

    function test_AddXPMultiple() public {
        vm.startPrank(game);
        registry.addXP(player1, 500);
        registry.addXP(player1, 500);
        vm.stopPrank();

        assertEq(registry.getXP(player1), 1000);
    }

    function test_AddXPNotAuthorized() public {
        vm.prank(player1);
        vm.expectRevert("XPRegistry: not authorized");
        registry.addXP(player2, 1000);
    }

    function test_AddXPZeroPlayer() public {
        vm.prank(game);
        vm.expectRevert("XPRegistry: zero player");
        registry.addXP(address(0), 1000);
    }

    function test_AddXPEmitsLevelUp() public {
        vm.prank(game);
        vm.expectEmit(true, false, false, true);
        emit XPRegistry.LevelUp(player1, 10);
        registry.addXP(player1, 1000);
    }

    // ==================== LEVEL CALCULATION ====================

    function test_Level1to9() public {
        // Level 1-9: 0-999 XP
        assertEq(registry.getLevel(player1), 1); // 0 XP

        vm.startPrank(game);
        registry.addXP(player1, 125);
        assertEq(registry.getLevel(player1), 2);

        registry.addXP(player1, 750); // 875 total
        assertEq(registry.getLevel(player1), 8);
        vm.stopPrank();
    }

    function test_Level10to19() public {
        vm.prank(game);
        registry.addXP(player1, 1000);
        assertEq(registry.getLevel(player1), 10);

        vm.prank(game);
        registry.addXP(player1, 800); // 1800 total
        assertEq(registry.getLevel(player1), 12);
    }

    function test_Level20to29() public {
        vm.prank(game);
        registry.addXP(player1, 5000);
        assertEq(registry.getLevel(player1), 20);

        vm.prank(game);
        registry.addXP(player1, 5000); // 10000 total
        assertEq(registry.getLevel(player1), 25);
    }

    function test_Level30to39() public {
        vm.prank(game);
        registry.addXP(player1, 15_000);
        assertEq(registry.getLevel(player1), 30);

        vm.prank(game);
        registry.addXP(player1, 12_500); // 27500 total
        assertEq(registry.getLevel(player1), 35);
    }

    function test_Level40to49() public {
        vm.prank(game);
        registry.addXP(player1, 40_000);
        assertEq(registry.getLevel(player1), 40);

        vm.prank(game);
        registry.addXP(player1, 30_000); // 70000 total
        assertEq(registry.getLevel(player1), 45);
    }

    function test_Level50CasinoOwner() public {
        vm.prank(game);
        registry.addXP(player1, 100_000);
        assertEq(registry.getLevel(player1), 50);
        assertTrue(registry.isCasinoOwner(player1));
    }

    function test_Level60Plus() public {
        vm.prank(game);
        registry.addXP(player1, 200_000);
        assertEq(registry.getLevel(player1), 60);

        vm.prank(game);
        registry.addXP(player1, 300_000); // 500000 total
        assertEq(registry.getLevel(player1), 63);
    }

    // ==================== PERKS ====================

    function test_PerksNewcomer() public view {
        XPRegistry.LevelPerks memory perks = registry.getPlayerPerks(player1);
        assertEq(perks.level, 1);
        assertEq(perks.houseEdgeReductionBps, 0);
        assertEq(perks.maxBetMultiplier, 100);
        assertFalse(perks.vipTableAccess);
        assertFalse(perks.casinoOwner);
        assertFalse(perks.canCreateVault);
        assertEq(perks.title, "Newcomer");
    }

    function test_PerksLevel10Rookie() public {
        vm.prank(game);
        registry.addXP(player1, 1000);

        XPRegistry.LevelPerks memory perks = registry.getPlayerPerks(player1);
        assertEq(perks.houseEdgeReductionBps, 10);
        assertEq(perks.title, "Rookie");
    }

    function test_PerksLevel20Regular() public {
        vm.prank(game);
        registry.addXP(player1, 5000);

        XPRegistry.LevelPerks memory perks = registry.getPlayerPerks(player1);
        assertEq(perks.houseEdgeReductionBps, 20);
        assertEq(perks.maxBetMultiplier, 150);
        assertEq(perks.title, "Regular");
    }

    function test_PerksLevel30VIP() public {
        vm.prank(game);
        registry.addXP(player1, 15_000);

        XPRegistry.LevelPerks memory perks = registry.getPlayerPerks(player1);
        assertEq(perks.houseEdgeReductionBps, 30);
        assertEq(perks.maxBetMultiplier, 200);
        assertTrue(perks.vipTableAccess);
        assertTrue(registry.hasVIPAccess(player1));
        assertEq(perks.title, "VIP");
    }

    function test_PerksLevel40HighRoller() public {
        vm.prank(game);
        registry.addXP(player1, 40_000);

        XPRegistry.LevelPerks memory perks = registry.getPlayerPerks(player1);
        assertEq(perks.houseEdgeReductionBps, 40);
        assertEq(perks.maxBetMultiplier, 300);
        assertTrue(perks.canCreateVault);
        assertTrue(registry.canCreateVault(player1));
        assertEq(perks.title, "High Roller");
    }

    function test_PerksLevel50CasinoOwner() public {
        vm.prank(game);
        registry.addXP(player1, 100_000);

        XPRegistry.LevelPerks memory perks = registry.getPlayerPerks(player1);
        assertEq(perks.houseEdgeReductionBps, 50);
        assertEq(perks.maxBetMultiplier, 500);
        assertTrue(perks.casinoOwner);
        assertEq(perks.title, "Casino Owner");
    }

    // ==================== HOUSE EDGE REDUCTION ====================

    function test_GetHouseEdgeReduction() public {
        assertEq(registry.getHouseEdgeReduction(player1), 0);

        vm.prank(game);
        registry.addXP(player1, 1000);
        assertEq(registry.getHouseEdgeReduction(player1), 10);

        vm.prank(game);
        registry.addXP(player1, 99_000); // 100k total
        assertEq(registry.getHouseEdgeReduction(player1), 50);
    }

    // ==================== XP TO NEXT LEVEL ====================

    function test_XPToNextLevel() public {
        // At level 1, need 125 XP for level 2
        uint256 needed = registry.xpToNextLevel(player1);
        assertEq(needed, 125);

        vm.prank(game);
        registry.addXP(player1, 100);
        needed = registry.xpToNextLevel(player1);
        assertEq(needed, 25); // 125 - 100 = 25
    }

    function test_XPToNextLevelHighLevel() public {
        vm.prank(game);
        registry.addXP(player1, 100_000); // Level 50

        uint256 needed = registry.xpToNextLevel(player1);
        assertEq(needed, 10_000); // Need 110k for level 51, have 100k
    }

    function test_XPToNextLevelVeryHigh() public {
        vm.prank(game);
        registry.addXP(player1, 200_000); // Level 60

        uint256 needed = registry.xpToNextLevel(player1);
        assertEq(needed, 100_000); // Level 61 at 300k
    }

    // ==================== ADMIN ====================

    function test_AuthorizeCaller() public {
        address newGame = address(0x999);
        registry.authorizeCaller(newGame);
        assertTrue(registry.authorizedCallers(newGame));
    }

    function test_AuthorizeCallerOnlyOwner() public {
        vm.prank(player1);
        vm.expectRevert("XPRegistry: only owner");
        registry.authorizeCaller(address(0x999));
    }

    function test_AuthorizeCallerZeroAddress() public {
        vm.expectRevert("XPRegistry: zero caller");
        registry.authorizeCaller(address(0));
    }

    function test_RevokeCaller() public {
        registry.revokeCaller(game);
        assertFalse(registry.authorizedCallers(game));
    }

    function test_RevokeCallerOnlyOwner() public {
        vm.prank(player1);
        vm.expectRevert("XPRegistry: only owner");
        registry.revokeCaller(game);
    }

    function test_TransferOwnership() public {
        registry.transferOwnership(player1);
        assertEq(registry.owner(), player1);
    }

    function test_TransferOwnershipOnlyOwner() public {
        vm.prank(player1);
        vm.expectRevert("XPRegistry: only owner");
        registry.transferOwnership(player2);
    }

    function test_TransferOwnershipZeroAddress() public {
        vm.expectRevert("XPRegistry: zero owner");
        registry.transferOwnership(address(0));
    }

    // ==================== FUZZ TESTS ====================

    function testFuzz_AddXP(
        uint256 amount
    ) public {
        amount = bound(amount, 0, 10_000_000);

        vm.prank(game);
        registry.addXP(player1, amount);

        assertEq(registry.getXP(player1), amount);
        assertTrue(registry.getLevel(player1) >= 1);
    }
}
