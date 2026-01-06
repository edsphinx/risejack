// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test, console } from "forge-std/Test.sol";
import { VyreJackETH } from "../src/games/standalone/VyreJackETH.sol";
import { IVRFCoordinator } from "../src/interfaces/IVRFCoordinator.sol";

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
 * @title VyreJackTest
 * @notice Test suite for VyreJackETH contract with VRF
 */
contract VyreJackETHTest is Test {
    VyreJackETH public risejack;
    MockVRFCoordinator public mockVRF;

    address public player = address(0x1);
    address public treasury = address(0x999);
    address public vrfCoordinator;

    function setUp() public {
        // Deploy mock VRF first
        mockVRF = new MockVRFCoordinator();
        vrfCoordinator = address(mockVRF);

        // Deploy Blackjack with mock VRF coordinator and treasury
        risejack = new VyreJackETH(vrfCoordinator, treasury);

        // Fund accounts
        vm.deal(player, 10 ether);
        vm.deal(address(risejack), 100 ether);

        // Set initial timestamp to allow first bet (cooldown is 30s, lastGameTimestamp defaults to 0)
        vm.warp(31);
    }

    // ==================== PLACE BET TESTS ====================

    function test_PlaceBet() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(game.player, player);
        // Bet stored is net of 2% house fee: 0.01 * 98% = 0.0098 ether
        assertEq(game.bet, 0.0098 ether);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.WaitingForDeal));
    }

    function test_RevertOnBelowMinBet() public {
        vm.prank(player);
        vm.expectRevert("Invalid bet amount");
        risejack.placeBet{ value: 0.0001 ether }();
    }

    function test_RevertOnAboveMaxBet() public {
        vm.prank(player);
        vm.expectRevert("Invalid bet amount");
        risejack.placeBet{ value: 2 ether }();
    }

    function test_RevertOnDoublePlace() public {
        vm.startPrank(player);
        risejack.placeBet{ value: 0.01 ether }();

        vm.expectRevert("Invalid game state");
        risejack.placeBet{ value: 0.01 ether }();
        vm.stopPrank();
    }

    // ==================== VRF CALLBACK TESTS ====================

    function test_InitialDeal() public {
        // Place bet (this generates requestId = 1)
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Simulate VRF callback with specific cards
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 5; // Player card 1: 6
        randomNumbers[1] = 9; // Dealer card 1: 10
        randomNumbers[2] = 6; // Player card 2: 7 (total 13)
        randomNumbers[3] = 7; // Dealer card 2: 8

        // Call from VRF coordinator
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);

        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.PlayerTurn));
        assertEq(game.playerCards.length, 2);
        assertEq(game.dealerCards.length, 2);
    }

    function test_PlayerBlackjack() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Give player blackjack: Ace + King
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 0; // Player: Ace
        randomNumbers[1] = 9; // Dealer: 10
        randomNumbers[2] = 12; // Player: King
        randomNumbers[3] = 7; // Dealer: 8

        uint256 playerBalanceBefore = player.balance;

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);

        // Player should have received 3:2 payout on netBet
        // netBet = 0.01 * 0.98 = 0.0098 ether
        // Payout: 0.0098 * 1.5 + 0.0098 = 0.0245 ether
        assertEq(player.balance, playerBalanceBefore + 0.0245 ether);

        // Game should be reset
        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.Idle));
    }

    function test_DealerBlackjack() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Give dealer blackjack: Ace + King
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 5; // Player: 6
        randomNumbers[1] = 0; // Dealer: Ace
        randomNumbers[2] = 6; // Player: 7
        randomNumbers[3] = 12; // Dealer: King

        uint256 playerBalanceBefore = player.balance;

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);

        // Player loses, no payout
        assertEq(player.balance, playerBalanceBefore);

        // Game should be reset
        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.Idle));
    }

    function test_BothBlackjack() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Both get blackjack
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 0; // Player: Ace
        randomNumbers[1] = 0; // Dealer: Ace
        randomNumbers[2] = 12; // Player: King
        randomNumbers[3] = 12; // Dealer: King

        uint256 playerBalanceBefore = player.balance;

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);

        // Push - player gets netBet back (0.0098 ether)
        assertEq(player.balance, playerBalanceBefore + 0.0098 ether);
    }

    // ==================== HIT TESTS ====================

    function test_Hit() public {
        // Setup: place bet and deal initial cards
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 5; // Player: 6
        initialCards[1] = 9; // Dealer: 10
        initialCards[2] = 6; // Player: 7 (total 13)
        initialCards[3] = 7; // Dealer: 8

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);

        // Player hits
        vm.prank(player);
        risejack.hit();

        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.WaitingForHit));

        // VRF callback for hit (requestId = 2)
        uint256[] memory hitCard = new uint256[](1);
        hitCard[0] = 4; // 5 (total now 18)

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(2, hitCard);

        game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.PlayerTurn));
        assertEq(game.playerCards.length, 3);
    }

    function test_HitAndBust() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Deal high cards
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9; // Player: 10
        initialCards[1] = 9; // Dealer: 10
        initialCards[2] = 11; // Player: Q (total 20)
        initialCards[3] = 7; // Dealer: 8

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

        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.Idle));
    }

    // ==================== STAND TESTS ====================

    function test_Stand() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Deal: Player 20, Dealer showing 6
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9; // Player: 10
        initialCards[1] = 5; // Dealer: 6
        initialCards[2] = 9; // Player: 10 (total 20)
        initialCards[3] = 9; // Dealer: 10 (hidden, total 16)

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);

        // Player stands
        vm.prank(player);
        risejack.stand();

        // Dealer has 16, must hit
        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.DealerTurn));
    }

    // ==================== SURRENDER TEST ====================

    function test_Surrender() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Deal initial cards
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 4; // Player: 5
        initialCards[1] = 9; // Dealer: 10
        initialCards[2] = 10; // Player: J (total 15 - bad hand)
        initialCards[3] = 7; // Dealer: 8

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);

        uint256 playerBalanceBefore = player.balance;

        // Surrender
        vm.prank(player);
        risejack.surrender();

        // Should get half of netBet back (0.0098 / 2 = 0.0049 ether)
        assertEq(player.balance, playerBalanceBefore + 0.0049 ether);

        // Game should be reset
        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.Idle));
    }

    // ==================== HAND VALUE TESTS ====================

    function test_CalculateHandValue() public view {
        uint8[] memory cards = new uint8[](2);
        cards[0] = 9; // 10
        cards[1] = 6; // 7
        (uint8 value, bool isSoft) = risejack.calculateHandValue(cards);
        assertEq(value, 17);
        assertEq(isSoft, false);
    }

    function test_CalculateHandValueWithAce() public view {
        uint8[] memory cards = new uint8[](2);
        cards[0] = 0; // Ace
        cards[1] = 6; // 7
        (uint8 value, bool isSoft) = risejack.calculateHandValue(cards);
        assertEq(value, 18);
        assertEq(isSoft, true);
    }

    function test_CalculateHandValueWithAceBusted() public view {
        uint8[] memory cards = new uint8[](3);
        cards[0] = 0; // Ace
        cards[1] = 6; // 7
        cards[2] = 8; // 9
        (uint8 value, bool isSoft) = risejack.calculateHandValue(cards);
        assertEq(value, 17);
        assertEq(isSoft, false);
    }

    function test_Blackjack() public view {
        uint8[] memory cards = new uint8[](2);
        cards[0] = 0; // Ace = 11
        cards[1] = 12; // King = 10
        (uint8 value,) = risejack.calculateHandValue(cards);
        assertEq(value, 21);
    }

    function test_GetCardInfo() public view {
        (uint8 rank, uint8 suit) = risejack.getCardInfo(0);
        assertEq(rank, 0); // Ace
        assertEq(suit, 0); // Hearts

        (rank, suit) = risejack.getCardInfo(51);
        assertEq(rank, 12); // King
        assertEq(suit, 3); // Spades
    }

    // ==================== SECURITY TESTS ====================

    function test_OnlyVRFCanFulfill() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

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
        risejack.placeBet{ value: 0.01 ether }();

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
        risejack.placeBet{ value: 0.01 ether }();

        // Deal cards that make double attractive (11)
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 4; // Player: 5
        initialCards[1] = 9; // Dealer: 10
        initialCards[2] = 5; // Player: 6 (total 11)
        initialCards[3] = 7; // Dealer: 8

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);

        // Double down - must send netBet amount (0.0098 ether)
        vm.prank(player);
        risejack.double{ value: 0.0098 ether }();

        VyreJackETH.Game memory game = risejack.getGameState(player);
        // Total bet = netBet + netBet = 0.0098 + 0.0098 = 0.0196 ether
        assertEq(game.bet, 0.0196 ether);
        assertEq(game.isDoubled, true);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.WaitingForHit));
    }

    function test_DoubleDownMustMatchBet() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 4;
        initialCards[1] = 9;
        initialCards[2] = 5;
        initialCards[3] = 7;

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);

        vm.prank(player);
        // Must match netBet (0.0098 ether), not msg.value
        vm.expectRevert("Must match original bet");
        risejack.double{ value: 0.005 ether }();
    }

    // ==================== HOUSE PROTECTION TESTS ====================

    function test_ContractPause() public {
        // Pause contract
        risejack.pause();
        assertTrue(risejack.paused());

        // Cannot place bet when paused
        vm.prank(player);
        vm.expectRevert("Contract is paused");
        risejack.placeBet{ value: 0.01 ether }();
    }

    function test_ContractUnpause() public {
        risejack.pause();
        assertTrue(risejack.paused());

        risejack.unpause();
        assertFalse(risejack.paused());

        // Can place bet again
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();
    }

    function test_OnlyOwnerCanPause() public {
        vm.prank(player);
        vm.expectRevert("Only owner");
        risejack.pause();
    }

    function test_GetHouseStats() public view {
        (uint256 balance, uint256 exposure, uint256 reserve, uint256 losses, bool isPaused) =
            risejack.getHouseStats();

        assertEq(balance, 100 ether);
        assertEq(exposure, 0);
        assertGt(reserve, 0);
        assertEq(losses, 0);
        assertFalse(isPaused);
    }

    function test_ExposureTracking() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

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
        risejack.placeBet{ value: 0.1 ether }();

        // Deal: Player 20, Dealer 16
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9; // Player: 10
        initialCards[1] = 5; // Dealer: 6
        initialCards[2] = 9; // Player: 10 (20)
        initialCards[3] = 9; // Dealer: 10 (16)

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

        // Player wins (2:1 payout on netBet 0.098 ether)
        assertEq(player.balance, playerBalanceBefore + 0.196 ether);
    }

    function test_DealerWinsFullGame() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.1 ether }();

        // Deal: Player 15, Dealer 18
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 4; // Player: 5
        initialCards[1] = 7; // Dealer: 8
        initialCards[2] = 9; // Player: 10 (15)
        initialCards[3] = 9; // Dealer: 10 (18)

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
        risejack.placeBet{ value: 0.1 ether }();

        // Deal: Both get 20
        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9; // Player: 10
        initialCards[1] = 9; // Dealer: 10
        initialCards[2] = 9; // Player: 10 (20)
        initialCards[3] = 9; // Dealer: 10 (20)

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);

        uint256 playerBalanceBefore = player.balance;

        vm.prank(player);
        risejack.stand();

        // Push - netBet returned (0.098 ether)
        assertEq(player.balance, playerBalanceBefore + 0.098 ether);
    }

    // ==================== PLAYER WITHDRAW TEST ====================

    function test_WithdrawPendingPayout() public {
        // Deploy a contract that rejects ETH to simulate failed payout
        RejectingReceiver rejecter = new RejectingReceiver();
        address rejecterAddr = address(rejecter);
        vm.deal(rejecterAddr, 1 ether);

        // Place bet from rejecting contract
        vm.prank(rejecterAddr);
        risejack.placeBet{ value: 0.01 ether }();

        // Give player blackjack so they win
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 0; // Player: Ace
        randomNumbers[1] = 9; // Dealer: 10
        randomNumbers[2] = 12; // Player: King (Blackjack!)
        randomNumbers[3] = 7; // Dealer: 8

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);

        // Payout should have failed, check pending withdrawal
        // netBet = 0.01 * 0.98 = 0.0098 ether
        // Blackjack payout = 0.0098 * 1.5 + 0.0098 = 0.0245 ether
        uint256 expectedPayout = 0.0245 ether;
        uint256 pending = risejack.pendingWithdrawals(rejecterAddr);
        assertEq(pending, expectedPayout, "Pending withdrawal should equal failed payout");

        // Now enable receiving and withdraw
        rejecter.enableReceiving();
        uint256 balanceBefore = rejecterAddr.balance;

        vm.prank(rejecterAddr);
        risejack.withdraw();

        // Verify withdrawal succeeded
        assertEq(
            rejecterAddr.balance,
            balanceBefore + expectedPayout,
            "Balance should increase by payout"
        );
        assertEq(
            risejack.pendingWithdrawals(rejecterAddr), 0, "Pending should be zero after withdraw"
        );
    }

    function test_WithdrawRevertsIfNoPending() public {
        vm.prank(player);
        vm.expectRevert("No pending withdrawal");
        risejack.withdraw();
    }

    // ==================== GAME TIMEOUT TESTS ====================

    function test_CancelTimedOutGame() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.1 ether }();

        uint256 playerBalanceBefore = player.balance;

        // Fast forward 1 hour + 1 second
        vm.warp(block.timestamp + 1 hours + 1);

        // Anyone can cancel timed out game
        risejack.cancelTimedOutGame(player);

        // Player gets netBet refund (0.1 * 0.98 = 0.098 ether)
        assertEq(player.balance, playerBalanceBefore + 0.098 ether);

        // Game reset
        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.Idle));
    }

    function test_CannotCancelActiveGame() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.1 ether }();

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
        risejack.placeBet{ value: 0.1 ether }();

        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 5;
        initialCards[1] = 9;
        initialCards[2] = 6;
        initialCards[3] = 7;

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);

        // Now in PlayerTurn state
        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.PlayerTurn));

        // Fast forward past timeout
        vm.warp(block.timestamp + 1 hours + 1);

        uint256 playerBalanceBefore = player.balance;
        risejack.cancelTimedOutGame(player);

        // Player gets netBet refund even in PlayerTurn (0.098 ether)
        assertEq(player.balance, playerBalanceBefore + 0.098 ether);
    }

    // ==================== VIEW FUNCTION TESTS ====================

    function test_GetPlayerHandValue() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9; // Player: 10
        initialCards[1] = 5; // Dealer: 6
        initialCards[2] = 6; // Player: 7 (17)
        initialCards[3] = 7; // Dealer: 8

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);

        (uint8 value, bool isSoft) = risejack.getPlayerHandValue(player);
        assertEq(value, 17);
        assertFalse(isSoft);
    }

    function test_GetDealerVisibleValue() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        uint256[] memory initialCards = new uint256[](4);
        initialCards[0] = 9; // Player: 10
        initialCards[1] = 5; // Dealer: 6 (visible)
        initialCards[2] = 6; // Player: 7
        initialCards[3] = 9; // Dealer: 10 (hidden)

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, initialCards);

        // During player turn, only first dealer card visible (6)
        uint8 visibleValue = risejack.getDealerVisibleValue(player);
        assertEq(visibleValue, 6);
    }

    // ==================== FUZZ TESTS ====================

    function testFuzz_PlaceBet(
        uint256 amount
    ) public {
        // Bound to valid bet range
        amount = bound(amount, risejack.minBet(), risejack.maxBet());

        vm.prank(player);
        risejack.placeBet{ value: amount }();

        VyreJackETH.Game memory game = risejack.getGameState(player);
        // Bet stored is netBet (98% of amount after 2% house fee)
        uint256 expectedNetBet = amount - (amount * 200 / 10_000);
        assertEq(game.bet, expectedNetBet);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.WaitingForDeal));
    }

    function testFuzz_PlaceBetRevertsOutOfRange(
        uint256 amount
    ) public {
        // Test amounts outside valid range
        vm.assume(amount < risejack.minBet() || amount > risejack.maxBet());
        vm.assume(amount <= 10 ether); // Cap to avoid overflow

        vm.deal(player, amount + 1 ether);
        vm.prank(player);
        vm.expectRevert("Invalid bet amount");
        risejack.placeBet{ value: amount }();
    }

    function testFuzz_CalculateHandValue(
        uint8 card1,
        uint8 card2
    ) public view {
        // Bound cards to valid range (0-51)
        card1 = uint8(bound(card1, 0, 51));
        card2 = uint8(bound(card2, 0, 51));

        uint8[] memory cards = new uint8[](2);
        cards[0] = card1;
        cards[1] = card2;

        (uint8 value, bool isSoft) = risejack.calculateHandValue(cards);

        // Value should always be between 2 and 21 (or bust up to 30)
        assertTrue(value >= 2 && value <= 30, "Invalid hand value");

        // Soft hands must have an ace counted as 11
        if (isSoft) {
            assertTrue(value <= 21, "Soft hand cannot be over 21");
        }
    }

    function testFuzz_FullGameWithRandomCards(
        uint256 card1,
        uint256 card2,
        uint256 card3,
        uint256 card4
    ) public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        uint256 playerBalanceBefore = player.balance;
        uint256 contractBalanceBefore = address(risejack).balance;

        // Deal random cards
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = card1;
        randomNumbers[1] = card2;
        randomNumbers[2] = card3;
        randomNumbers[3] = card4;

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);

        VyreJackETH.Game memory game = risejack.getGameState(player);

        // Game should either be in PlayerTurn or resolved (Idle means resolved)
        bool validState = game.state == VyreJackETH.GameState.PlayerTurn
            || game.state == VyreJackETH.GameState.Idle;
        assertTrue(validState, "Invalid game state after deal");

        // If resolved, funds should be conserved
        if (game.state == VyreJackETH.GameState.Idle) {
            uint256 totalAfter = player.balance + address(risejack).balance;
            uint256 totalBefore = playerBalanceBefore + contractBalanceBefore;
            assertEq(totalAfter, totalBefore, "Funds not conserved");
        }
    }

    // ==================== PHASE 3: VRF TIMEOUT TESTS ====================

    function test_RetryVRFRequest() public {
        // Place bet to create a VRF request
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Warp time past VRF_TIMEOUT
        vm.warp(block.timestamp + 5 minutes + 1);

        // Anyone can retry the request
        risejack.retryVRFRequest(1);

        // Should have created a new request (id 2)
        // The old request should be marked as fulfilled
        // New request should be pending
    }

    function test_RetryVRFRequestTooEarly() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Try to retry before timeout - should revert
        vm.expectRevert("Request not timed out");
        risejack.retryVRFRequest(1);
    }

    function test_ForceResolveGame() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        uint256 playerBalanceBefore = player.balance;

        // Owner force resolves
        risejack.forceResolveGame(player);

        // Player should receive netBet refund (0.0098 ether)
        assertEq(player.balance, playerBalanceBefore + 0.0098 ether, "Should receive full refund");

        // Game should be reset
        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.Idle), "Game should be idle");
    }

    function test_ForceResolveGameOnlyOwner() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Non-owner tries to force resolve - should revert
        vm.prank(player);
        vm.expectRevert("Only owner");
        risejack.forceResolveGame(player);
    }

    function test_ForceResolveDoubledGame() public {
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Deal cards
        uint256[] memory randomNumbers = new uint256[](4);
        randomNumbers[0] = 5; // Player: 6
        randomNumbers[1] = 9; // Dealer: 10
        randomNumbers[2] = 8; // Player: 9 (total 15)
        randomNumbers[3] = 7; // Dealer: 8

        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, randomNumbers);

        // Double down (pays netBet amount 0.0098 ether, total bet now 0.0196 ether)
        vm.prank(player);
        risejack.double{ value: 0.0098 ether }();

        uint256 playerBalanceBefore = player.balance;

        // Owner force resolves
        risejack.forceResolveGame(player);

        // Player should receive total netBet (0.0098 + 0.0098 = 0.0196 ether)
        assertEq(
            player.balance, playerBalanceBefore + 0.0196 ether, "Should receive full bet refund"
        );

        // Game should be reset
        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.Idle), "Game should be idle");
    }

    // ==================== PHASE 4.3: RATE LIMITING TESTS ====================

    function test_CooldownPreventsRapidBets() public {
        // First bet succeeds
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Complete the game quickly
        uint256[] memory blackjackNumbers = new uint256[](4);
        blackjackNumbers[0] = 0; // Ace
        blackjackNumbers[1] = 5; // 6 (dealer)
        blackjackNumbers[2] = 9; // 10
        blackjackNumbers[3] = 6; // 7 (dealer)
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, blackjackNumbers);

        // Try to bet again immediately - should fail
        vm.prank(player);
        vm.expectRevert("Cooldown active");
        risejack.placeBet{ value: 0.01 ether }();
    }

    function test_CooldownAllowsAfterTimeout() public {
        // First bet succeeds
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        // Complete the game
        uint256[] memory blackjackNumbers = new uint256[](4);
        blackjackNumbers[0] = 0;
        blackjackNumbers[1] = 5;
        blackjackNumbers[2] = 9;
        blackjackNumbers[3] = 6;
        vm.prank(vrfCoordinator);
        risejack.rawFulfillRandomNumbers(1, blackjackNumbers);

        // Warp past cooldown
        vm.warp(block.timestamp + 31 seconds);

        // Second bet should succeed
        vm.prank(player);
        risejack.placeBet{ value: 0.01 ether }();

        VyreJackETH.Game memory game = risejack.getGameState(player);
        assertEq(uint256(game.state), uint256(VyreJackETH.GameState.WaitingForDeal));
    }

    // Receive function for contract to receive ETH from withdrawHouseFunds
    receive() external payable { }
}

/**
 * @title RejectingReceiver
 * @notice Helper contract that rejects ETH unless enabled, for testing pull payment pattern
 */
contract RejectingReceiver {
    bool public canReceive;

    function enableReceiving() external {
        canReceive = true;
    }

    receive() external payable {
        require(canReceive, "Rejecting ETH");
    }
}
