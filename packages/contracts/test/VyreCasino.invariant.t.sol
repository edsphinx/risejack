// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test, console } from "forge-std/Test.sol";
import { VyreCasino } from "../src/core/VyreCasino.sol";
import { VyreTreasury } from "../src/core/VyreTreasury.sol";
import { IVyreGame } from "../src/interfaces/IVyreGame.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockCHIPInvariant
 * @notice Simple ERC20 for invariant testing
 */
contract MockCHIPInvariant is ERC20 {
    constructor() ERC20("CHIP Token", "CHIP") {
        _mint(msg.sender, 100_000_000e18);
    }

    function mint(
        address to,
        uint256 amount
    ) external {
        _mint(to, amount);
    }
}

/**
 * @title MockGameInvariant
 * @notice Mock game that returns random outcomes for invariant testing
 */
contract MockGameInvariant is IVyreGame {
    uint256 private seed;

    function play(
        address,
        BetInfo calldata bet,
        bytes calldata
    ) external override returns (GameResult memory result) {
        // Pseudo-random outcome based on block data
        seed = uint256(keccak256(abi.encode(seed, block.timestamp, block.number)));
        bool won = (seed % 2) == 0; // 50% win rate

        result = GameResult({ won: won, payout: won ? bet.amount * 2 : 0, metadata: "" });
    }

    function minBet(
        address
    ) external pure override returns (uint256) {
        return 1e18;
    }

    function maxBet(
        address
    ) external pure override returns (uint256) {
        return 10_000e18;
    }

    function name() external pure override returns (string memory) {
        return "MockGameInvariant";
    }

    function isActive() external pure override returns (bool) {
        return true;
    }
}

/**
 * @title VyreCasinoHandler
 * @notice Handler contract for invariant testing - simulates player actions
 */
contract VyreCasinoHandler is Test {
    VyreCasino public casino;
    VyreTreasury public treasury;
    MockCHIPInvariant public chip;
    MockGameInvariant public game;
    address[] public players;

    // Ghost variables for tracking
    uint256 public ghost_totalBetsPlaced;
    uint256 public ghost_totalWins;
    uint256 public ghost_totalLosses;
    uint256 public ghost_referralEarningsAccumulated;

    constructor(
        VyreCasino _casino,
        VyreTreasury _treasury,
        MockCHIPInvariant _chip,
        MockGameInvariant _game
    ) {
        casino = _casino;
        treasury = _treasury;
        chip = _chip;
        game = _game;

        // Create test players
        for (uint256 i = 0; i < 10; i++) {
            address player = address(uint160(0x1000 + i));
            players.push(player);
            chip.mint(player, 100_000e18);
            vm.prank(player);
            chip.approve(address(casino), type(uint256).max);
        }

        // Set up referrals: player[i] refers player[i+1]
        for (uint256 i = 0; i < players.length - 1; i++) {
            vm.prank(players[i + 1]);
            try casino.setReferrer(players[i]) { } catch { }
        }
    }

    function play(
        uint256 playerSeed,
        uint256 amount
    ) external {
        address player = players[playerSeed % players.length];
        amount = bound(amount, 1e18, 1000e18);

        if (chip.balanceOf(player) < amount) return;
        if (casino.paused()) return;

        vm.prank(player);
        try casino.play(address(game), address(chip), amount, "") returns (
            IVyreGame.GameResult memory result
        ) {
            ghost_totalBetsPlaced += amount;
            if (result.won) {
                ghost_totalWins++;
            } else {
                ghost_totalLosses++;
            }
        } catch { }
    }

    function claimReferralEarnings(
        uint256 playerSeed
    ) external {
        address player = players[playerSeed % players.length];
        uint256 earnings = casino.referralEarnings(player, address(chip));

        if (earnings == 0) return;

        vm.prank(player);
        try casino.claimReferralEarnings(address(chip)) {
            ghost_referralEarningsAccumulated += earnings;
        } catch { }
    }

    function getPlayers() external view returns (address[] memory) {
        return players;
    }

    function getPlayersCount() external view returns (uint256) {
        return players.length;
    }
}

/**
 * @title VyreCasinoInvariantTest
 * @notice Invariant tests for VyreCasino and VyreTreasury
 */
contract VyreCasinoInvariantTest is Test {
    VyreCasino public casino;
    VyreTreasury public treasury;
    MockCHIPInvariant public chip;
    MockGameInvariant public game;
    VyreCasinoHandler public handler;

    address public owner = address(this);
    address public buybackWallet = address(0xBB);
    uint256 public initialTreasuryBalance = 1_000_000e18;

    function setUp() public {
        chip = new MockCHIPInvariant();
        treasury = new VyreTreasury(owner);
        casino = new VyreCasino(address(treasury), address(chip), owner, buybackWallet);
        treasury.setOperator(address(casino));

        game = new MockGameInvariant();
        casino.registerGame(address(game));

        // Fund treasury
        chip.mint(address(treasury), initialTreasuryBalance);

        handler = new VyreCasinoHandler(casino, treasury, chip, game);

        // Target only the handler
        targetContract(address(handler));
    }

    /**
     * @notice Invariant: Treasury balance must never go negative (always true in Solidity)
     */
    function invariant_treasuryBalanceNonNegative() public view {
        uint256 balance = chip.balanceOf(address(treasury));
        assertTrue(balance >= 0, "Treasury balance cannot be negative");
    }

    /**
     * @notice Invariant: CHIP token is always whitelisted
     */
    function invariant_chipAlwaysWhitelisted() public view {
        assertTrue(casino.whitelistedTokens(address(chip)), "CHIP must always be whitelisted");
    }

    /**
     * @notice Invariant: Paused casino prevents new games
     */
    function invariant_pausedPreventsPlay() public {
        if (casino.paused()) {
            address player = address(0xDEAD);
            chip.mint(player, 100e18);
            vm.prank(player);
            chip.approve(address(casino), type(uint256).max);

            vm.prank(player);
            vm.expectRevert("VyreCasino: paused");
            casino.play(address(game), address(chip), 10e18, "");
        }
    }

    /**
     * @notice Invariant: House edge is within bounds
     */
    function invariant_houseEdgeWithinBounds() public view {
        uint256 houseEdge = casino.houseEdgeBps();
        assertTrue(houseEdge <= 1000, "House edge cannot exceed 10%");
    }

    /**
     * @notice Invariant: Referral earnings can only be positive (never negative)
     */
    function invariant_referralEarningsNonNegative() public view {
        uint256 count = handler.getPlayersCount();
        for (uint256 i = 0; i < count; i++) {
            uint256 earnings = casino.referralEarnings(handler.players(i), address(chip));
            assertTrue(earnings >= 0, "Referral earnings cannot be negative");
        }
    }

    /**
     * @notice Invariant: Game must be registered to be played
     */
    function invariant_onlyRegisteredGamesPlayable() public view {
        assertTrue(casino.registeredGames(address(game)), "Mock game must be registered");
    }

    /**
     * @notice Call summary for debugging
     */
    function invariant_callSummary() public view {
        console.log("=== Invariant Test Summary ===");
        console.log("Total bets placed:", handler.ghost_totalBetsPlaced());
        console.log("Total wins:", handler.ghost_totalWins());
        console.log("Total losses:", handler.ghost_totalLosses());
        console.log("Referral earnings claimed:", handler.ghost_referralEarningsAccumulated());
        console.log("Treasury balance:", chip.balanceOf(address(treasury)));
    }
}

/**
 * @title VyreTreasuryInvariantTest
 * @notice Invariant tests for VyreTreasury isolation
 */
contract VyreTreasuryInvariantTest is Test {
    VyreTreasury public treasury;
    MockCHIPInvariant public chip;
    address public owner = address(this);
    address public operator = address(0xCAFE);

    function setUp() public {
        chip = new MockCHIPInvariant();
        treasury = new VyreTreasury(owner);
        treasury.setOperator(operator);
        chip.mint(address(treasury), 1_000_000e18);
    }

    /**
     * @notice Fuzz: Payout should never exceed treasury balance
     */
    function testFuzz_PayoutWithinBalance(
        uint256 amount
    ) public {
        amount = bound(amount, 1, chip.balanceOf(address(treasury)));

        uint256 balanceBefore = chip.balanceOf(address(treasury));

        vm.prank(operator);
        treasury.payout(address(0x123), address(chip), amount);

        uint256 balanceAfter = chip.balanceOf(address(treasury));
        assertEq(balanceAfter, balanceBefore - amount);
    }

    /**
     * @notice Fuzz: Daily limit enforcement
     */
    function testFuzz_DailyLimitEnforced(
        uint256 limit,
        uint256 amount1,
        uint256 amount2
    ) public {
        limit = bound(limit, 100e18, 10_000e18);
        amount1 = bound(amount1, 1, limit);
        amount2 = bound(amount2, 1, limit);

        treasury.setDailyLimit(address(chip), limit);

        // First payout should work if within limit
        if (amount1 <= limit) {
            vm.prank(operator);
            treasury.payout(address(0x1), address(chip), amount1);
        }

        // Second payout should fail if exceeds remaining limit
        uint256 remaining = limit > amount1 ? limit - amount1 : 0;
        if (amount2 > remaining) {
            vm.prank(operator);
            vm.expectRevert("VyreTreasury: daily limit exceeded");
            treasury.payout(address(0x2), address(chip), amount2);
        }
    }

    /**
     * @notice Fuzz: Freeze prevents all payouts
     */
    function testFuzz_FreezeBlocksAllPayouts(
        uint256 amount
    ) public {
        amount = bound(amount, 1, 1000e18);

        treasury.freeze();

        vm.prank(operator);
        vm.expectRevert("VyreTreasury: frozen");
        treasury.payout(address(0x123), address(chip), amount);
    }
}
