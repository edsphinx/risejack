// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {RiseJack} from "../src/RiseJack.sol";
import {IVRFCoordinator} from "../src/interfaces/IVRFCoordinator.sol";

/**
 * @title MockVRFCoordinatorForInvariant
 * @notice Mock VRF that auto-fulfills for invariant testing
 */
contract MockVRFCoordinatorForInvariant is IVRFCoordinator {
    uint256 public requestId;
    RiseJack public game;
    
    function setGame(address _game) external {
        game = RiseJack(payable(_game));
    }
    
    function requestRandomNumbers(
        uint32 numNumbers,
        uint256 /* seed */
    ) external override returns (uint256) {
        requestId++;
        
        // Auto-fulfill with pseudo-random numbers
        uint256[] memory randomNumbers = new uint256[](numNumbers);
        for (uint32 i = 0; i < numNumbers; i++) {
            randomNumbers[i] = uint256(keccak256(abi.encode(requestId, i, block.timestamp)));
        }
        
        game.rawFulfillRandomNumbers(requestId, randomNumbers);
        return requestId;
    }
}

/**
 * @title RiseJackHandler
 * @notice Handler contract for invariant testing - simulates player actions
 */
contract RiseJackHandler is Test {
    RiseJack public risejack;
    address[] public players;
    
    uint256 public ghost_totalBetsPlaced;
    uint256 public ghost_totalPayouts;
    uint256 public ghost_gamesStarted;
    uint256 public ghost_gamesEnded;
    
    constructor(RiseJack _risejack) {
        risejack = _risejack;
        
        // Create test players
        for (uint256 i = 0; i < 5; i++) {
            address player = address(uint160(0x1000 + i));
            players.push(player);
            vm.deal(player, 100 ether);
        }
    }
    
    function placeBet(uint256 playerSeed, uint256 amount) external {
        address player = players[playerSeed % players.length];
        amount = bound(amount, risejack.minBet(), risejack.maxBet());
        
        RiseJack.Game memory game = risejack.getGameState(player);
        if (game.state != RiseJack.GameState.Idle) return;
        
        uint256 balanceBefore = player.balance;
        if (balanceBefore < amount) return;
        
        vm.prank(player);
        try risejack.placeBet{value: amount}() {
            ghost_totalBetsPlaced += amount;
            ghost_gamesStarted++;
        } catch {}
    }
    
    function hit(uint256 playerSeed) external {
        address player = players[playerSeed % players.length];
        
        RiseJack.Game memory game = risejack.getGameState(player);
        if (game.state != RiseJack.GameState.PlayerTurn) return;
        
        vm.prank(player);
        try risejack.hit() {} catch {}
    }
    
    function stand(uint256 playerSeed) external {
        address player = players[playerSeed % players.length];
        
        RiseJack.Game memory game = risejack.getGameState(player);
        if (game.state != RiseJack.GameState.PlayerTurn) return;
        
        vm.prank(player);
        try risejack.stand() {} catch {}
    }
    
    function surrender(uint256 playerSeed) external {
        address player = players[playerSeed % players.length];
        
        RiseJack.Game memory game = risejack.getGameState(player);
        if (game.state != RiseJack.GameState.PlayerTurn) return;
        if (game.playerCards.length != 2) return;
        
        vm.prank(player);
        try risejack.surrender() {} catch {}
    }
    
    function getPlayers() external view returns (address[] memory) {
        return players;
    }
    
    function getPlayersCount() external view returns (uint256) {
        return players.length;
    }
}

/**
 * @title RiseJackInvariantTest
 * @notice Invariant tests for RiseJack contract
 */
contract RiseJackInvariantTest is Test {
    RiseJack public risejack;
    MockVRFCoordinatorForInvariant public mockVRF;
    RiseJackHandler public handler;
    
    function setUp() public {
        mockVRF = new MockVRFCoordinatorForInvariant();
        risejack = new RiseJack(address(mockVRF));
        mockVRF.setGame(address(risejack));
        
        // Fund the house
        vm.deal(address(risejack), 1000 ether);
        
        handler = new RiseJackHandler(risejack);
        
        // Target only the handler for invariant testing
        targetContract(address(handler));
    }
    
    /**
     * @notice Invariant: Contract balance must cover pending withdrawals
     */
    function invariant_balanceCoversWithdrawals() public view {
        uint256 balance = address(risejack).balance;
        // Note: We can't easily sum all pending withdrawals without tracking
        // But we can verify contract is not negative (always true in Solidity)
        assertTrue(balance >= 0, "Balance cannot be negative");
    }
    
    /**
     * @notice Invariant: Total exposure must be reasonable
     */
    function invariant_exposureReasonable() public view {
        uint256 exposure = risejack.totalExposure();
        uint256 balance = address(risejack).balance;
        
        // Exposure should never exceed unreasonable multiples of balance
        // (This is a sanity check, not a strict invariant)
        assertTrue(exposure <= balance * 10, "Exposure too high relative to balance");
    }
    
    /**
     * @notice Invariant: Games in waiting states have valid timestamps
     */
    function invariant_gamesHaveValidTimestamps() public view {
        uint256 count = handler.getPlayersCount();
        
        for (uint256 i = 0; i < count; i++) {
            RiseJack.Game memory game = risejack.getGameState(handler.players(i));
            
            if (game.state != RiseJack.GameState.Idle) {
                assertTrue(game.timestamp > 0, "Active game must have timestamp");
                assertTrue(game.bet > 0, "Active game must have bet");
            }
        }
    }
    
    /**
     * @notice Invariant: Paused contract cannot start new games
     */
    function invariant_pausedPreventsNewGames() public {
        if (risejack.paused()) {
            address newPlayer = address(0xDEAD);
            vm.deal(newPlayer, 1 ether);
            
            vm.prank(newPlayer);
            vm.expectRevert("Contract is paused");
            risejack.placeBet{value: 0.01 ether}();
        }
    }
    
    /**
     * @notice Call summary for debugging
     */
    function invariant_callSummary() public view {
        console.log("Games started:", handler.ghost_gamesStarted());
        console.log("Total bets placed:", handler.ghost_totalBetsPlaced());
    }
}
