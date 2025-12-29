// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {Blackjack} from "../src/Blackjack.sol";

contract BlackjackTest is Test {
    Blackjack public blackjack;
    address public player = address(0x1);

    function setUp() public {
        blackjack = new Blackjack();
        vm.deal(player, 10 ether);
        vm.deal(address(blackjack), 100 ether);
    }

    function test_PlaceBet() public {
        bytes32 commitHash = keccak256("test_secret");
        
        vm.prank(player);
        blackjack.placeBet{value: 0.01 ether}(commitHash);
        
        Blackjack.Game memory game = blackjack.getGameState(player);
        assertEq(game.player, player);
        assertEq(game.bet, 0.01 ether);
        assertEq(uint256(game.state), uint256(Blackjack.GameState.WaitingForReveal));
    }

    function test_RevertOnBelowMinBet() public {
        bytes32 commitHash = keccak256("test_secret");
        
        vm.prank(player);
        vm.expectRevert("Invalid bet amount");
        blackjack.placeBet{value: 0.0001 ether}(commitHash);
    }

    function test_RevertOnAboveMaxBet() public {
        bytes32 commitHash = keccak256("test_secret");
        
        vm.prank(player);
        vm.expectRevert("Invalid bet amount");
        blackjack.placeBet{value: 2 ether}(commitHash);
    }

    function test_CalculateHandValue() public view {
        // Test basic hand: 10 + 7 = 17
        uint8[] memory cards = new uint8[](2);
        cards[0] = 9; // 10
        cards[1] = 6; // 7
        (uint8 value, bool isSoft) = blackjack.calculateHandValue(cards);
        assertEq(value, 17);
        assertEq(isSoft, false);
    }

    function test_CalculateHandValueWithAce() public view {
        // Test soft hand: A + 7 = 18 (soft)
        uint8[] memory cards = new uint8[](2);
        cards[0] = 0; // Ace (value 11)
        cards[1] = 6; // 7
        (uint8 value, bool isSoft) = blackjack.calculateHandValue(cards);
        assertEq(value, 18);
        assertEq(isSoft, true);
    }

    function test_CalculateHandValueWithAceBusted() public view {
        // Test ace adjustment: A + 7 + 9 = 17 (ace becomes 1)
        uint8[] memory cards = new uint8[](3);
        cards[0] = 0; // Ace
        cards[1] = 6; // 7
        cards[2] = 8; // 9
        (uint8 value, bool isSoft) = blackjack.calculateHandValue(cards);
        assertEq(value, 17);
        assertEq(isSoft, false);
    }

    function test_Blackjack() public view {
        // Test blackjack: A + K = 21
        uint8[] memory cards = new uint8[](2);
        cards[0] = 0;  // Ace = 11
        cards[1] = 12; // King = 10
        (uint8 value, ) = blackjack.calculateHandValue(cards);
        assertEq(value, 21);
    }
}
