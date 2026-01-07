// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { TableVault, TableVaultFactory } from "../src/vaults/TableVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock CHIP token
contract MockCHIP is ERC20 {
    constructor() ERC20("MockCHIP", "CHIP") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(
        address to,
        uint256 amount
    ) external {
        _mint(to, amount);
    }
}

/// @dev Mock XP Registry
contract MockXPRegistry {
    mapping(address => bool) public canCreate;
    mapping(address => uint8) public levels;

    function canCreateVault(
        address user
    ) external view returns (bool) {
        return canCreate[user];
    }

    function getLevel(
        address user
    ) external view returns (uint8) {
        return levels[user];
    }

    function setCanCreateVault(
        address user,
        bool can
    ) external {
        canCreate[user] = can;
    }

    function setLevel(
        address user,
        uint8 level
    ) external {
        levels[user] = level;
    }
}

/**
 * @title TableVault Test Suite
 * @notice Tests for ERC4626 social trading vault
 */
contract TableVaultTest is Test {
    TableVaultFactory factory;
    MockCHIP chip;
    MockXPRegistry xpRegistry;

    address owner = address(this);
    address creator = address(0x1000);
    address player1 = address(0x2000);
    address player2 = address(0x3000);

    function setUp() public {
        chip = new MockCHIP();
        xpRegistry = new MockXPRegistry();

        factory = new TableVaultFactory(address(xpRegistry), address(chip), owner);

        // Setup creator as Level 40+
        xpRegistry.setCanCreateVault(creator, true);
        xpRegistry.setLevel(creator, 45);

        // Give tokens
        chip.mint(creator, 100_000e18);
        chip.mint(player1, 10_000e18);
        chip.mint(player2, 10_000e18);

        // Pre-approve factory for creator to pay creation fees
        vm.prank(creator);
        chip.approve(address(factory), type(uint256).max);

        vm.label(address(factory), "Factory");
        vm.label(creator, "Creator");
        vm.label(player1, "Player1");
    }

    // ==================== FACTORY DEPLOYMENT ====================

    function test_FactoryDeployment() public view {
        assertEq(address(factory.xpRegistry()), address(xpRegistry));
        assertEq(address(factory.chip()), address(chip));
        assertEq(factory.owner(), owner);
        assertEq(factory.creationFee(), 500e18); // Default fee
    }

    function test_FactoryConstructorZeroXpRegistry() public {
        vm.expectRevert("TableVaultFactory: zero xpRegistry");
        new TableVaultFactory(address(0), address(chip), owner);
    }

    function test_FactoryConstructorZeroChip() public {
        vm.expectRevert("TableVaultFactory: zero chip");
        new TableVaultFactory(address(xpRegistry), address(0), owner);
    }

    function test_FactoryConstructorZeroOwner() public {
        vm.expectRevert("TableVaultFactory: zero owner");
        new TableVaultFactory(address(xpRegistry), address(chip), address(0));
    }

    // ==================== CREATE VAULT ====================

    function test_CreateVault() public {
        vm.prank(creator);
        address vault = factory.createVault("HighRoller Table");

        address[] memory vaults = factory.getVaultsByCreator(creator);
        assertEq(vaults.length, 1);
        assertEq(vaults[0], vault);
    }

    function test_CreateVaultNotLevel40() public {
        vm.prank(player1); // Not Level 40+
        vm.expectRevert("TableVaultFactory: must be Level 40+");
        factory.createVault("Cannot Create");
    }

    function test_CreateVaultWithFee() public {
        factory.setCreationFee(1000e18);

        vm.startPrank(creator);
        chip.approve(address(factory), 1000e18);

        uint256 chipBefore = chip.balanceOf(creator);
        factory.createVault("Premium Table");
        uint256 chipAfter = chip.balanceOf(creator);

        assertEq(chipBefore - chipAfter, 1000e18);
        vm.stopPrank();
    }

    // ==================== VAULT DEPOSIT/WITHDRAW ====================

    function test_VaultDeposit() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Test Table");
        TableVault vault = TableVault(vaultAddr);

        vm.startPrank(player1);
        chip.approve(vaultAddr, 1000e18);
        uint256 shares = vault.deposit(1000e18, player1);
        vm.stopPrank();

        assertGt(shares, 0);
        assertEq(vault.balanceOf(player1), shares);
    }

    function test_VaultWithdraw() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Test Table");
        TableVault vault = TableVault(vaultAddr);

        vm.startPrank(player1);
        chip.approve(vaultAddr, 1000e18);
        uint256 shares = vault.deposit(1000e18, player1);

        uint256 withdrawn = vault.withdraw(500e18, player1, player1);
        vm.stopPrank();

        assertGt(withdrawn, 0);
    }

    function test_VaultInfo() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Info Table");
        TableVault vault = TableVault(vaultAddr);

        (
            address _creator,
            string memory _tableName,
            uint256 _totalAssets,
            uint256 _totalShares,
            uint256 _performanceFee,
            uint256 _accumulatedFees
        ) = vault.getVaultInfo();

        assertEq(_creator, creator);
        assertEq(_tableName, "Info Table");
        assertEq(_totalAssets, 0);
        assertEq(_totalShares, 0);
        assertEq(_performanceFee, 1000); // Default 10%
        assertEq(_accumulatedFees, 0);
    }

    // ==================== ADMIN ====================

    function test_SetCreationFee() public {
        factory.setCreationFee(500e18);
        assertEq(factory.creationFee(), 500e18);
    }

    function test_SetCreationFeeOnlyOwner() public {
        vm.prank(creator);
        vm.expectRevert("TableVaultFactory: only owner");
        factory.setCreationFee(500e18);
    }

    function test_TransferOwnership() public {
        factory.transferOwnership(creator);
        assertEq(factory.owner(), creator);
    }

    function test_TransferOwnershipZeroAddress() public {
        vm.expectRevert("TableVaultFactory: zero owner");
        factory.transferOwnership(address(0));
    }

    // ==================== VAULT CREATOR FUNCTIONS ====================

    function test_SetPerformanceFee() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Test Table");
        TableVault vault = TableVault(vaultAddr);

        vm.prank(creator);
        vault.setPerformanceFee(2000); // 20%

        (,,,, uint256 _performanceFee,) = vault.getVaultInfo();
        assertEq(_performanceFee, 2000);
    }

    function test_SetPerformanceFeeMax30() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Test Table");
        TableVault vault = TableVault(vaultAddr);

        vm.prank(creator);
        vm.expectRevert("TableVault: max 30%");
        vault.setPerformanceFee(4000);
    }

    function test_SetPerformanceFeeOnlyCreator() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Test Table");
        TableVault vault = TableVault(vaultAddr);

        vm.prank(player1);
        vm.expectRevert("TableVault: only creator");
        vault.setPerformanceFee(2000);
    }

    // ==================== VAULT REDEEM ====================

    function test_VaultRedeem() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Redeem Table");
        TableVault vault = TableVault(vaultAddr);

        vm.startPrank(player1);
        chip.approve(vaultAddr, 1000e18);
        uint256 shares = vault.deposit(1000e18, player1);

        uint256 assets = vault.redeem(shares / 2, player1, player1);
        vm.stopPrank();

        assertGt(assets, 0);
    }

    // ==================== GAME FUNCTIONS ====================

    function test_AuthorizeGame() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Game Table");
        TableVault vault = TableVault(vaultAddr);

        address game = address(0x5555);
        vm.prank(creator);
        vault.authorizeGame(game);

        assertTrue(vault.authorizedGames(game));
    }

    function test_AuthorizeGameOnlyCreator() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Game Table");
        TableVault vault = TableVault(vaultAddr);

        vm.prank(player1);
        vm.expectRevert("TableVault: only creator");
        vault.authorizeGame(address(0x5555));
    }

    function test_RevokeGame() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Game Table");
        TableVault vault = TableVault(vaultAddr);

        address game = address(0x5555);
        vm.prank(creator);
        vault.authorizeGame(game);

        vm.prank(creator);
        vault.revokeGame(game);

        assertFalse(vault.authorizedGames(game));
    }

    function test_RecordProfit() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Profit Table");
        TableVault vault = TableVault(vaultAddr);

        // Deposit first
        vm.startPrank(player1);
        chip.approve(vaultAddr, 1000e18);
        vault.deposit(1000e18, player1);
        vm.stopPrank();

        // Authorize game
        address game = address(0x5555);
        vm.prank(creator);
        vault.authorizeGame(game);

        // Give game tokens and approve
        chip.mint(game, 500e18);
        vm.startPrank(game);
        chip.approve(vaultAddr, 500e18);
        vault.recordProfit(500e18);
        vm.stopPrank();

        // Fees should be accumulated
        (,,,,, uint256 fees) = vault.getVaultInfo();
        assertGt(fees, 0);
    }

    function test_RecordProfitZeroAmount() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Profit Table");
        TableVault vault = TableVault(vaultAddr);

        address game = address(0x5555);
        vm.prank(creator);
        vault.authorizeGame(game);

        vm.prank(game);
        vm.expectRevert("TableVault: zero profit");
        vault.recordProfit(0);
    }

    function test_RecordProfitNotAuthorized() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Profit Table");
        TableVault vault = TableVault(vaultAddr);

        vm.prank(player1);
        vm.expectRevert("TableVault: not authorized game");
        vault.recordProfit(100e18);
    }

    function test_RecordLoss() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Loss Table");
        TableVault vault = TableVault(vaultAddr);

        // Deposit first
        vm.startPrank(player1);
        chip.approve(vaultAddr, 1000e18);
        vault.deposit(1000e18, player1);
        vm.stopPrank();

        // Authorize game
        address game = address(0x5555);
        vm.prank(creator);
        vault.authorizeGame(game);

        uint256 assetsBefore = vault.totalAssets();

        vm.prank(game);
        vault.recordLoss(200e18);

        assertEq(vault.totalAssets(), assetsBefore - 200e18);
        assertEq(chip.balanceOf(game), 200e18);
    }

    function test_RecordLossZeroAmount() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Loss Table");
        TableVault vault = TableVault(vaultAddr);

        address game = address(0x5555);
        vm.prank(creator);
        vault.authorizeGame(game);

        vm.prank(game);
        vm.expectRevert("TableVault: zero loss");
        vault.recordLoss(0);
    }

    function test_RecordLossExceedsAssets() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Loss Table");
        TableVault vault = TableVault(vaultAddr);

        vm.startPrank(player1);
        chip.approve(vaultAddr, 100e18);
        vault.deposit(100e18, player1);
        vm.stopPrank();

        address game = address(0x5555);
        vm.prank(creator);
        vault.authorizeGame(game);

        vm.prank(game);
        vm.expectRevert("TableVault: loss exceeds assets");
        vault.recordLoss(200e18);
    }

    function test_RecordLossNotAuthorized() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Loss Table");
        TableVault vault = TableVault(vaultAddr);

        vm.prank(player1);
        vm.expectRevert("TableVault: not authorized game");
        vault.recordLoss(100e18);
    }

    // ==================== CLAIM FEES ====================

    function test_ClaimFees() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Fee Table");
        TableVault vault = TableVault(vaultAddr);

        // Deposit
        vm.startPrank(player1);
        chip.approve(vaultAddr, 1000e18);
        vault.deposit(1000e18, player1);
        vm.stopPrank();

        // Authorize game and record profit
        address game = address(0x5555);
        vm.prank(creator);
        vault.authorizeGame(game);

        chip.mint(game, 500e18);
        vm.startPrank(game);
        chip.approve(vaultAddr, 500e18);
        vault.recordProfit(500e18);
        vm.stopPrank();

        // Claim fees
        uint256 creatorBalanceBefore = chip.balanceOf(creator);

        vm.prank(creator);
        vault.claimFees();

        assertGt(chip.balanceOf(creator), creatorBalanceBefore);

        // Fees should be zero now
        (,,,,, uint256 fees) = vault.getVaultInfo();
        assertEq(fees, 0);
    }

    function test_ClaimFeesNoFees() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("No Fee Table");
        TableVault vault = TableVault(vaultAddr);

        vm.prank(creator);
        vm.expectRevert("TableVault: no fees");
        vault.claimFees();
    }

    // ==================== COOLDOWN ====================

    function test_SetWithdrawalCooldown() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Cooldown Table");
        TableVault vault = TableVault(vaultAddr);

        vm.prank(creator);
        vault.setWithdrawalCooldown(1 days);

        assertEq(vault.withdrawalCooldown(), 1 days);
    }

    function test_SetWithdrawalCooldownMaxOneWeek() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Cooldown Table");
        TableVault vault = TableVault(vaultAddr);

        vm.prank(creator);
        vm.expectRevert("TableVault: max 7 days");
        vault.setWithdrawalCooldown(8 days);
    }

    function test_WithdrawDuringCooldown() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Cooldown Table");
        TableVault vault = TableVault(vaultAddr);

        // Set 1 day cooldown
        vm.prank(creator);
        vault.setWithdrawalCooldown(1 days);

        // Deposit
        vm.startPrank(player1);
        chip.approve(vaultAddr, 1000e18);
        vault.deposit(1000e18, player1);

        // Try to withdraw immediately
        vm.expectRevert("TableVault: cooldown not passed");
        vault.withdraw(500e18, player1, player1);
        vm.stopPrank();
    }

    function test_WithdrawAfterCooldown() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Cooldown Table");
        TableVault vault = TableVault(vaultAddr);

        // Set 1 day cooldown
        vm.prank(creator);
        vault.setWithdrawalCooldown(1 days);

        // Deposit
        vm.startPrank(player1);
        chip.approve(vaultAddr, 1000e18);
        vault.deposit(1000e18, player1);

        // Warp past cooldown
        vm.warp(block.timestamp + 2 days);

        // Should work now
        vault.withdraw(500e18, player1, player1);
        vm.stopPrank();
    }

    // ==================== VIEW FUNCTIONS ====================

    function test_AvailableBankroll() public {
        vm.prank(creator);
        address vaultAddr = factory.createVault("Bankroll Table");
        TableVault vault = TableVault(vaultAddr);

        // Deposit
        vm.startPrank(player1);
        chip.approve(vaultAddr, 1000e18);
        vault.deposit(1000e18, player1);
        vm.stopPrank();

        assertEq(vault.availableBankroll(), 1000e18);
    }

    // ==================== FACTORY VIEW ====================

    function test_GetAllVaults() public {
        vm.prank(creator);
        factory.createVault("Vault 1");

        vm.prank(creator);
        factory.createVault("Vault 2");

        address[] memory vaults = factory.getAllVaults();
        assertEq(vaults.length, 2);
    }
}
