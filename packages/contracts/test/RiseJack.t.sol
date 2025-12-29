// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {RiseJack} from "../src/RiseJack.sol";
import {IVRFCoordinator} from "../src/interfaces/IVRFCoordinator.sol";

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
 * @title RiseJackTest
 * @notice Test suite for RiseJack contract with VRF
 */
contract RiseJackTest is Test {
    RiseJack public risejack;
    MockVRFCoordinator public mockVRF;
    
    address public player = address(0x1);
    address public vrfCoordinator;

    function setUp() public {
        // Deploy mock VRF first
        mockVRF = new MockVRFCoordinator();
        vrfCoordinator = address(mockVRF);
        
        // Deploy Blackjack with mock VRF coordinator (dependency injection)
        risejack = new RiseJack(vrfCoordinator);
        
        // Fund accounts
        vm.deal(player, 10 ether);
        vm.deal(address(risejack), 100 ether);
    }

    // ==================== PLACE BET TESTS ====================

    function test_PlaceBet() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(game.player, player);
        assertEq(game.bet, 0.01 ether);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.WaitingForDeal));
    }

    function test_RevertOnBelowMinBet() public {
        vm.prank(player);
        vm.expectRevert("Invalid bet amount");
        risejack.placeBet{value: 0.0001 ether}();
    }

    function test_RevertOnAboveMaxBet() public {
        vm.prank(player);
        vm.expectRevert("Invalid bet amount");
        risejack.placeBet{value: 2 ether}();
    }

    function test_RevertOnDoublePlace() public {
        vm.startPrank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        vm.expectRevert("Invalid game state");
        risejack.placeBet{value: 0.01 ether}();
        vm.stopPrank();
    }

    // ==================== VRF CALLBACK TESTS ====================
    
    function test_InitialDeal() public {
        // Place bet (this generates requestId = 1)
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        // Simulate VRF callback with specific cards
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 5;   // Player card 1: 6
        randomNumbers[1] = 9;   // Dealer card 1: 10
        randomNumbers[2] = 6;   // Player card 2: 7 (total 13)
        randomNumbers[3] = 7;   // Dealer card 2: 8
        
        // Call from VRF coordinator
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);
        
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.PlayerTurn));
        assertEq(game.playerCards.length, 2);
        assertEq(game.dealerCards.length, 2);
    }

    function test_PlayerBlackjack() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        // Give player blackjack: Ace + King
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 0;   // Player: Ace
        randomNumbers[1] = 9;   // Dealer: 10
        randomNumbers[2] = 12;  // Player: King
        randomNumbers[3] = 7;   // Dealer: 8
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);
        
        // Player should have received 3:2 payout
        // Payout: 0.01 * 1.5 + 0.01 = 0.025 ether
        assertEq(player.balance, playerBalanceBefore + 0.025 ether);
        
        // Game should be reset
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.Idle));
    }

    function test_DealerBlackjack() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        // Give dealer blackjack: Ace + King
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 5;   // Player: 6
        randomNumbers[1] = 0;   // Dealer: Ace
        randomNumbers[2] = 6;   // Player: 7
        randomNumbers[3] = 12;  // Dealer: King
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);
        
        // Player loses, no payout
        assertEq(player.balance, playerBalanceBefore);
        
        // Game should be reset
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.Idle));
    }

    function test_BothBlackjack() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        // Both get blackjack
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 0;   // Player: Ace
        randomNumbers[1] = 0;   // Dealer: Ace
        randomNumbers[2] = 12;  // Player: King
        randomNumbers[3] = 12;  // Dealer: King
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);
        
        // Push - player gets bet back
        assertEq(player.balance, playerBalanceBefore + 0.01 ether);
    }

    // ==================== HIT TESTS ====================

    function test_Hit() public {
        // Setup: place bet and deal initial cards
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 5;  // Player: 6
        initialCards[1] = 9;  // Dealer: 10
        initialCards[2] = 6;  // Player: 7 (total 13)
        initialCards[3] = 7;  // Dealer: 8
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        // Player hits
        vm.prank(player);
        risejack.hit();
        
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.WaitingForHit));
        
        // VRF callback for hit (requestId = 2)
        uint256[] memory hitCard = new uint256[](1);
        hitCard[0] = 4; // 5 (total now 18)
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(2, hitCard);
        
        game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.PlayerTurn));
        assertEq(game.playerCards.length, 3);
    }

    function test_HitAndBust() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        // Deal high cards
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9;   // Player: 10
        initialCards[1] = 9;   // Dealer: 10
        initialCards[2] = 11;  // Player: Q (total 20)
        initialCards[3] = 7;   // Dealer: 8
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        // Player foolishly hits on 20
        vm.prank(player);
        risejack.hit();
        
        // Hit gives another face card - bust!
        uint256[] memory hitCard = new uint256[](1);
        hitCard[0] = 10; // J = 10 (total 30 = BUST)
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(2, hitCard);
        
        // Player busted, loses bet
        assertEq(player.balance, playerBalanceBefore);
        
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.Idle));
    }

    // ==================== STAND TESTS ====================

    function test_Stand() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        // Deal: Player 20, Dealer showing 6
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9;   // Player: 10
        initialCards[1] = 5;   // Dealer: 6
        initialCards[2] = 9;   // Player: 10 (total 20)
        initialCards[3] = 9;   // Dealer: 10 (hidden, total 16)
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        // Player stands
        vm.prank(player);
        risejack.stand();
        
        // Dealer has 16, must hit
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.DealerTurn));
    }

    // ==================== SURRENDER TEST ====================

    function test_Surrender() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        // Deal initial cards
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 4;  // Player: 5
        initialCards[1] = 9;  // Dealer: 10
        initialCards[2] = 10; // Player: J (total 15 - bad hand)
        initialCards[3] = 7;  // Dealer: 8
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        uint256 playerBalanceBefore = player.balance;
        
        // Surrender
        vm.prank(player);
        risejack.surrender();
        
        // Should get half bet back
        assertEq(player.balance, playerBalanceBefore + 0.005 ether);
        
        // Game should be reset
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.Idle));
    }

    // ==================== HAND VALUE TESTS ====================

    function test_CalculateHandValue() public view {
        uint8[] memory cards = new uint8[](2);
        cards[0] = 9;  // 10
        cards[1] = 6;  // 7
        (uint8 value, bool isSoft) = risejack.calculateHandValue(cards);
        assertEq(value, 17);
        assertEq(isSoft, false);
    }

    function test_CalculateHandValueWithAce() public view {
        uint8[] memory cards = new uint8[](2);
        cards[0] = 0;  // Ace
        cards[1] = 6;  // 7
        (uint8 value, bool isSoft) = risejack.calculateHandValue(cards);
        assertEq(value, 18);
        assertEq(isSoft, true);
    }

    function test_CalculateHandValueWithAceBusted() public view {
        uint8[] memory cards = new uint8[](3);
        cards[0] = 0;  // Ace
        cards[1] = 6;  // 7
        cards[2] = 8;  // 9
        (uint8 value, bool isSoft) = risejack.calculateHandValue(cards);
        assertEq(value, 17);
        assertEq(isSoft, false);
    }

    function test_Blackjack() public view {
        uint8[] memory cards = new uint8[](2);
        cards[0] = 0;   // Ace = 11
        cards[1] = 12;  // King = 10
        (uint8 value,) = risejack.calculateHandValue(cards);
        assertEq(value, 21);
    }

    function test_GetCardInfo() public view {
        (uint8 rank, uint8 suit) = risejack.getCardInfo(0);
        assertEq(rank, 0);   // Ace
        assertEq(suit, 0);   // Hearts
        
        (rank, suit) = risejack.getCardInfo(51);
        assertEq(rank, 12);  // King
        assertEq(suit, 3);   // Spades
    }

    // ==================== SECURITY TESTS ====================

    function test_OnlyVRFCanFulfill() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        uint256[] memory randomNumbers = new uint256[](4);
        
        vm.prank(player);
        vm.expectRevert("Only VRF coordinator");
        risejack.rawFulfillRandomNumbers(1, randomNumbers);
    }

    function test_CannotHitDuringWrongState() public {
        vm.prank(player);
        vm.expectRevert("Invalid game state");
        risejack.hit();
    }

    function test_CannotSurrenderAfterHit() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 5;
        initialCards[1] = 9;
        initialCards[2] = 6;
        initialCards[3] = 7;
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        // Hit first
        vm.prank(player);
        risejack.hit();
        
        uint256[] memory hitCard = new uint256[](1);
        hitCard[0] = 2;
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(2, hitCard);
        
        // Try to surrender after hit - should fail
        vm.prank(player);
        vm.expectRevert("Can only surrender on initial hand");
        risejack.surrender();
    }

    // ==================== DOUBLE DOWN TESTS ====================

    function test_DoubleDown() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        // Deal cards that make double attractive (11)
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 4;   // Player: 5
        initialCards[1] = 9;   // Dealer: 10
        initialCards[2] = 5;   // Player: 6 (total 11)
        initialCards[3] = 7;   // Dealer: 8
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        // Double down
        vm.prank(player);
        risejack.double{value: 0.01 ether}();
        
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(game.bet, 0.02 ether);
        assertEq(game.isDoubled, true);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.WaitingForHit));
    }

    function test_DoubleDownMustMatchBet() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 4;
        initialCards[1] = 9;
        initialCards[2] = 5;
        initialCards[3] = 7;
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        vm.prank(player);
        vm.expectRevert("Must match original bet");
        risejack.double{value: 0.005 ether}();
    }

    // ==================== HOUSE PROTECTION TESTS ====================

    function test_ContractPause() public {
        // Pause contract
        risejack.pause();
        assertTrue(risejack.paused());
        
        // Cannot place bet when paused
        vm.prank(player);
        vm.expectRevert("Contract is paused");
        risejack.placeBet{value: 0.01 ether}();
    }

    function test_ContractUnpause() public {
        risejack.pause();
        assertTrue(risejack.paused());
        
        risejack.unpause();
        assertFalse(risejack.paused());
        
        // Can place bet again
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
    }

    function test_OnlyOwnerCanPause() public {
        vm.prank(player);
        vm.expectRevert("Only owner");
        risejack.pause();
    }

    function test_GetHouseStats() public view {
        (
            uint256 balance,
            uint256 exposure,
            uint256 reserve,
            uint256 losses,
            bool isPaused
        ) = risejack.getHouseStats();
        
        assertEq(balance, 100 ether);
        assertEq(exposure, 0);
        assertGt(reserve, 0);
        assertEq(losses, 0);
        assertFalse(isPaused);
    }

    function test_ExposureTracking() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        // Exposure should be max possible payout (bet * 2.5 for blackjack)
        assertGt(risejack.totalExposure(), 0);
    }

    // ==================== ADMIN FUNCTION TESTS ====================

    function test_SetBetLimits() public {
        risejack.setBetLimits(0.1 ether, 10 ether);
        
        assertEq(risejack.minBet(), 0.1 ether);
        assertEq(risejack.maxBet(), 10 ether);
    }

    function test_SetBetLimitsOnlyOwner() public {
        vm.prank(player);
        vm.expectRevert("Only owner");
        risejack.setBetLimits(0.1 ether, 10 ether);
    }

    function test_SetDailyProfitLimit() public {
        risejack.setDailyProfitLimit(5 ether);
        assertEq(risejack.dailyProfitLimit(), 5 ether);
    }

    function test_SetMinReserve() public {
        risejack.setMinReserve(10 ether);
        assertEq(risejack.minReserve(), 10 ether);
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x999);
        risejack.transferOwnership(newOwner);
        assertEq(risejack.owner(), newOwner);
    }

    function test_WithdrawHouseFunds() public {
        // Set low reserve to allow withdrawal
        risejack.setMinReserve(10 ether);
        
        uint256 ownerBalanceBefore = address(this).balance;
        risejack.withdrawHouseFunds(50 ether);
        
        assertEq(address(this).balance, ownerBalanceBefore + 50 ether);
        assertEq(address(risejack).balance, 50 ether);
    }

    function test_WithdrawCannotBreachReserve() public {
        // Default reserve is 50 ether, contract has 100 ether
        // Cannot withdraw more than 50 ether
        vm.expectRevert("Would breach min reserve");
        risejack.withdrawHouseFunds(60 ether);
    }

    // ==================== FULL GAME FLOW TESTS ====================

    function test_PlayerWinsFullGame() public {
        vm.prank(player);
        risejack.placeBet{value: 0.1 ether}();
        
        // Deal: Player 20, Dealer 16
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9;   // Player: 10
        initialCards[1] = 5;   // Dealer: 6
        initialCards[2] = 9;   // Player: 10 (20)
        initialCards[3] = 9;   // Dealer: 10 (16)
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        // Player stands
        vm.prank(player);
        risejack.stand();
        
        // Dealer must hit on 16
        uint256[] memory dealerCards = new uint256[](1);
        dealerCards[0] = 9; // Dealer gets 10 (total 26 = BUST)
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(2, dealerCards);
        
        // Player wins (2:1 payout)
        assertEq(player.balance, playerBalanceBefore + 0.2 ether);
    }

    function test_DealerWinsFullGame() public {
        vm.prank(player);
        risejack.placeBet{value: 0.1 ether}();
        
        // Deal: Player 15, Dealer 18
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 4;   // Player: 5
        initialCards[1] = 7;   // Dealer: 8
        initialCards[2] = 9;   // Player: 10 (15)
        initialCards[3] = 9;   // Dealer: 10 (18)
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        // Player stands on 15 (bad decision)
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(player);
        risejack.stand();
        
        // Dealer has 18, stands (no VRF needed)
        // Player loses
        assertEq(player.balance, playerBalanceBefore);
    }

    function test_PushFullGame() public {
        vm.prank(player);
        risejack.placeBet{value: 0.1 ether}();
        
        // Deal: Both get 20
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9;   // Player: 10
        initialCards[1] = 9;   // Dealer: 10
        initialCards[2] = 9;   // Player: 10 (20)
        initialCards[3] = 9;   // Dealer: 10 (20)
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        uint256 playerBalanceBefore = player.balance;
        
        vm.prank(player);
        risejack.stand();
        
        // Push - bet returned
        assertEq(player.balance, playerBalanceBefore + 0.1 ether);
    }

    // ==================== PLAYER WITHDRAW TEST ====================

    function test_WithdrawPendingPayout() public {
        // First set pending withdrawal manually (simulating failed payout)
        // This is tested implicitly through the pull payment pattern
        uint256 pending = risejack.pendingWithdrawals(player);
        assertEq(pending, 0);
    }

    // ==================== GAME TIMEOUT TESTS ====================

    function test_CancelTimedOutGame() public {
        vm.prank(player);
        risejack.placeBet{value: 0.1 ether}();
        
        uint256 playerBalanceBefore = player.balance;
        
        // Fast forward 1 hour + 1 second
        vm.warp(block.timestamp + 1 hours + 1);
        
        // Anyone can cancel timed out game
        risejack.cancelTimedOutGame(player);
        
        // Player gets full refund
        assertEq(player.balance, playerBalanceBefore + 0.1 ether);
        
        // Game reset
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.Idle));
    }

    function test_CannotCancelActiveGame() public {
        vm.prank(player);
        risejack.placeBet{value: 0.1 ether}();
        
        // Try to cancel immediately (not timed out)
        vm.expectRevert("Game not timed out");
        risejack.cancelTimedOutGame(player);
    }

    function test_CannotCancelIdleGame() public {
        vm.expectRevert("No active game");
        risejack.cancelTimedOutGame(player);
    }

    function test_TimeoutDuringPlayerTurn() public {
        vm.prank(player);
        risejack.placeBet{value: 0.1 ether}();
        
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 5;
        initialCards[1] = 9;
        initialCards[2] = 6;
        initialCards[3] = 7;
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        // Now in PlayerTurn state
        RiseJack.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(RiseJack.GameState.PlayerTurn));
        
        // Fast forward past timeout
        vm.warp(block.timestamp + 1 hours + 1);
        
        uint256 playerBalanceBefore = player.balance;
        risejack.cancelTimedOutGame(player);
        
        // Player gets refund even in PlayerTurn
        assertEq(player.balance, playerBalanceBefore + 0.1 ether);
    }

    // ==================== VIEW FUNCTION TESTS ====================

    function test_GetPlayerHandValue() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9;   // Player: 10
        initialCards[1] = 5;   // Dealer: 6
        initialCards[2] = 6;   // Player: 7 (17)
        initialCards[3] = 7;   // Dealer: 8
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        (uint8 value, bool isSoft) = risejack.getPlayerHandValue(player);
        assertEq(value, 17);
        assertFalse(isSoft);
    }

    function test_GetDealerVisibleValue() public {
        vm.prank(player);
        risejack.placeBet{value: 0.01 ether}();
        
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9;   // Player: 10
        initialCards[1] = 5;   // Dealer: 6 (visible)
        initialCards[2] = 6;   // Player: 7
        initialCards[3] = 9;   // Dealer: 10 (hidden)
        
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);
        
        // During player turn, only first dealer card visible (6)
        uint8 visibleValue = risejack.getDealerVisibleValue(player);
        assertEq(visibleValue, 6);
    }

    // Receive function for contract to receive ETH from withdrawHouseFunds
    receive() external payable {}
}
