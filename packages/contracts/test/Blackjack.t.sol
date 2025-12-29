// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {Blackjack} from "../src/Blackjack.sol";
import {IVRFCoordinator} from "../src/interfaces/IVRFCoordinator.sol";
import {IVRFConsumer} from "../src/interfaces/IVRFConsumer.sol";

/**
 * @title MockVRFCoordinator
 * @notice Mock VRF Coordinator for testing
 */
contract MockVRFCoordinator is IVRFCoordinator {
    uint256 public lastRequestId;
    address public lastRequester;
    uint32 public lastNumNumbers;

    function requestRandomNumbers(
        uint32 numNumbers,
        uint256 /* seed */
    ) external override returns (uint256 requestId) {
        lastRequestId++;
        lastRequester = msg.sender;
        lastNumNumbers = numNumbers;
        return lastRequestId;
    }

    function getLastRequestId() external view returns (uint256) {
        return lastRequestId;
    }
}

/**
 * @title TestableBlackjack
 * @notice Blackjack that allows setting custom VRF coordinator for testing
 */
contract TestableBlackjack is Blackjack {
    address private testCoordinator;

    function setTestCoordinator(address _coordinator) external {
        testCoordinator = _coordinator;
    }

    // Override the modifier to use test coordinator
    function _getCoordinator() internal view returns (address) {
        return testCoordinator != address(0) ? testCoordinator : address(coordinator);
    }
}

/**
 * @title BlackjackTest
 * @notice Test suite for Blackjack contract with VRF
 */
contract BlackjackTest is Test {
    Blackjack public blackjack;
    MockVRFCoordinator public mockVRF;
    
    address public player = address(0x1);
    address public vrfCoordinator;

    function setUp() public {
        // Deploy mock VRF first
        mockVRF = new MockVRFCoordinator();
        vrfCoordinator = address(mockVRF);
        
        // Deploy Blackjack but we need to mock the coordinator call
        // Use vm.etch to place mock at the hardcoded address
        address hardcodedVRF = 0x9d57aB4517ba97349551C876a01a7580B1338909;
        vm.etch(hardcodedVRF, address(mockVRF).code);
        
        // Copy storage from mock to hardcoded address
        // This is complex, so instead let's use a different approach:
        // We'll test with the mock by calling directly
        
        blackjack = new Blackjack();
        
        // Fund accounts
        vm.deal(player, 10 ether);
        vm.deal(address(blackjack), 100 ether);
        
        // Update vrfCoordinator to the hardcoded one
        vrfCoordinator = hardcodedVRF;
    }

    // ==================== PLACE BET TESTS ====================

    function test_PlaceBet() public {
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        Blackjack.Game memory game = blackjack.getGameState(player);
        assertEq(game.player, player);
        assertEq(game.bet, 0.01 ether);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.WaitingForDeal));
    }

    function test_RevertOnBelowMinBet() public {
        vm.prank(player);
        vm.expectRevert("Invalid bet amount");
        blackjack.placeBet{value: 0.0001 ether}();
    }

    function test_RevertOnAboveMaxBet() public {
        vm.prank(player);
        vm.expectRevert("Invalid bet amount");
        blackjack.placeBet{value: 2 ether}();
    }

    function test_RevertOnDoublePlace() public {
        vm.startPrank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        vm.expectRevert("Invalid game state");
        blackjack.placeBet{value: 0.01 ether}();
        vm.stopPrank();
    }

    // ==================== VRF CALLBACK TESTS ====================
    
    function test_InitialDeal() public {
        // Place bet (this generates requestId = 1)
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        // Simulate VRF callback with specific cards
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 5;   // Player card 1: 6
        randomNumbers[1] = 9;   // Dealer card 1: 10
        randomNumbers[2] = 6;   // Player card 2: 7 (total 13)
        randomNumbers[3] = 7;   // Dealer card 2: 8
        
        // Call from VRF coordinator
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(1, randomNumbers);
        
        Blackjack.Game memory game = blackjack.getGameState(player);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.PlayerTurn));
        assertEq(game.playerCards.length, 2);
        assertEq(game.dealerCards.length, 2);
    }

    function test_PlayerBlackjack() public {
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        // Give player blackjack: Ace + King
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 0;   // Player: Ace
        randomNumbers[1] = 9;   // Dealer: 10
        randomNumbers[2] = 12;  // Player: King
        randomNumbers[3] = 7;   // Dealer: 8
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(1, randomNumbers);
        
        // Player should have received 3:2 payout
        // Payout: 0.01 * 1.5 + 0.01 = 0.025 ether
        assertEq(player.balance, playerBalanceBefore + 0.025 ether);
        
        // Game should be reset
        Blackjack.Game memory game = blackjack.getGameState(player);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.Idle));
    }

    function test_DealerBlackjack() public {
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        // Give dealer blackjack: Ace + King
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 5;   // Player: 6
        randomNumbers[1] = 0;   // Dealer: Ace
        randomNumbers[2] = 6;   // Player: 7
        randomNumbers[3] = 12;  // Dealer: King
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(1, randomNumbers);
        
        // Player loses, no payout
        assertEq(player.balance, playerBalanceBefore);
        
        // Game should be reset
        Blackjack.Game memory game = blackjack.getGameState(player);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.Idle));
    }

    function test_BothBlackjack() public {
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        // Both get blackjack
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 0;   // Player: Ace
        randomNumbers[1] = 0;   // Dealer: Ace
        randomNumbers[2] = 12;  // Player: King
        randomNumbers[3] = 12;  // Dealer: King
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(1, randomNumbers);
        
        // Push - player gets bet back
        assertEq(player.balance, playerBalanceBefore + 0.01 ether);
    }

    // ==================== HIT TESTS ====================

    function test_Hit() public {
        // Setup: place bet and deal initial cards
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 5;  // Player: 6
        initialCards[1] = 9;  // Dealer: 10
        initialCards[2] = 6;  // Player: 7 (total 13)
        initialCards[3] = 7;  // Dealer: 8
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(1, initialCards);
        
        // Player hits
        vm.prank(player);
        blackjack.hit();
        
        Blackjack.Game memory game = blackjack.getGameState(player);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.WaitingForHit));
        
        // VRF callback for hit (requestId = 2)
        uint256[] memory hitCard = new uint256[](1);
        hitCard[0] = 4; // 5 (total now 18)
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(2, hitCard);
        
        game = blackjack.getGameState(player);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.PlayerTurn));
        assertEq(game.playerCards.length, 3);
    }

    function test_HitAndBust() public {
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        // Deal high cards
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9;   // Player: 10
        initialCards[1] = 9;   // Dealer: 10
        initialCards[2] = 11;  // Player: Q (total 20)
        initialCards[3] = 7;   // Dealer: 8
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(1, initialCards);
        
        // Player foolishly hits on 20
        vm.prank(player);
        blackjack.hit();
        
        // Hit gives another face card - bust!
        uint256[] memory hitCard = new uint256[](1);
        hitCard[0] = 10; // J = 10 (total 30 = BUST)
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(2, hitCard);
        
        // Player busted, loses bet
        assertEq(player.balance, playerBalanceBefore);
        
        Blackjack.Game memory game = blackjack.getGameState(player);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.Idle));
    }

    // ==================== STAND TESTS ====================

    function test_Stand() public {
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        // Deal: Player 20, Dealer showing 6
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9;   // Player: 10
        initialCards[1] = 5;   // Dealer: 6
        initialCards[2] = 9;   // Player: 10 (total 20)
        initialCards[3] = 9;   // Dealer: 10 (hidden, total 16)
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(1, initialCards);
        
        // Player stands
        vm.prank(player);
        blackjack.stand();
        
        // Dealer has 16, must hit
        Blackjack.Game memory game = blackjack.getGameState(player);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.DealerTurn));
    }

    // ==================== SURRENDER TEST ====================

    function test_Surrender() public {
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        // Deal initial cards
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 4;  // Player: 5
        initialCards[1] = 9;  // Dealer: 10
        initialCards[2] = 10; // Player: J (total 15 - bad hand)
        initialCards[3] = 7;  // Dealer: 8
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(1, initialCards);
        
        uint256 playerBalanceBefore = player.balance;
        
        // Surrender
        vm.prank(player);
        blackjack.surrender();
        
        // Should get half bet back
        assertEq(player.balance, playerBalanceBefore + 0.005 ether);
        
        // Game should be reset
        Blackjack.Game memory game = blackjack.getGameState(player);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.Idle));
    }

    // ==================== HAND VALUE TESTS ====================

    function test_CalculateHandValue() public view {
        uint8[] memory cards = new uint8[](2);
        cards[0] = 9;  // 10
        cards[1] = 6;  // 7
        (uint8 value, bool isSoft) = blackjack.calculateHandValue(cards);
        assertEq(value, 17);
        assertEq(isSoft, false);
    }

    function test_CalculateHandValueWithAce() public view {
        uint8[] memory cards = new uint8[](2);
        cards[0] = 0;  // Ace
        cards[1] = 6;  // 7
        (uint8 value, bool isSoft) = blackjack.calculateHandValue(cards);
        assertEq(value, 18);
        assertEq(isSoft, true);
    }

    function test_CalculateHandValueWithAceBusted() public view {
        uint8[] memory cards = new uint8[](3);
        cards[0] = 0;  // Ace
        cards[1] = 6;  // 7
        cards[2] = 8;  // 9
        (uint8 value, bool isSoft) = blackjack.calculateHandValue(cards);
        assertEq(value, 17);
        assertEq(isSoft, false);
    }

    function test_Blackjack() public view {
        uint8[] memory cards = new uint8[](2);
        cards[0] = 0;   // Ace = 11
        cards[1] = 12;  // King = 10
        (uint8 value,) = blackjack.calculateHandValue(cards);
        assertEq(value, 21);
    }

    function test_GetCardInfo() public view {
        (uint8 rank, uint8 suit) = blackjack.getCardInfo(0);
        assertEq(rank, 0);   // Ace
        assertEq(suit, 0);   // Hearts
        
        (rank, suit) = blackjack.getCardInfo(51);
        assertEq(rank, 12);  // King
        assertEq(suit, 3);   // Spades
    }

    // ==================== SECURITY TESTS ====================

    function test_OnlyVRFCanFulfill() public {
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        uint256[] memory randomNumbers = new uint256[](4);
        
        vm.prank(player);
        vm.expectRevert("Only VRF coordinator");
        blackjack.rawFulfillRandomNumbers(1, randomNumbers);
    }

    function test_CannotHitDuringWrongState() public {
        vm.prank(player);
        vm.expectRevert("Invalid game state");
        blackjack.hit();
    }

    function test_CannotSurrenderAfterHit() public {
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}();
        
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 5;
        initialCards[1] = 9;
        initialCards[2] = 6;
        initialCards[3] = 7;
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(1, initialCards);
        
        // Hit first
        vm.prank(player);
        blackjack.hit();
        
        uint256[] memory hitCard = new uint256[](1);
        hitCard[0] = 2;
        
        vm.prank(vrfCoordinator);
        blackjack.rawFulfillRandomNumbers(2, hitCard);
        
        // Try to surrender after hit - should fail
        vm.prank(player);
        vm.expectRevert("Can only surrender on initial hand");
        blackjack.surrender();
    }
}
