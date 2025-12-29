// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { RiseJack } from "../src/RiseJack.sol";
import { IVRFCoordinator } from "../src/interfaces/IVRFCoordinator.sol";

/**
 * @title AutoFulfillVRF
 * @notice VRF that auto-fulfills requests for Medusa testing
 */
contract AutoFulfillVRF is IVRFCoordinator {
    uint256 public requestId;
    RiseJack public game;
    uint256 public seed;

    function setGame(
        address _game
    ) external {
        game = RiseJack(payable(_game));
    }

    function requestRandomNumbers(
        uint32 numNumbers,
        uint256 _seed
    ) external override returns (uint256) {
        requestId++;
        seed = _seed;

        // Auto-fulfill with deterministic random numbers
        uint256[] memory randomNumbers = new uint256[](numNumbers);
        for (uint32 i = 0; i < numNumbers; i++) {
            randomNumbers[i] = uint256(keccak256(abi.encode(requestId, i, seed)));
        }

        game.rawFulfillRandomNumbers(requestId, randomNumbers);
        return requestId;
    }
}

/**
 * @title RiseJackMedusaTest
 * @notice Property-based tests for Medusa fuzzer
 * @dev All functions prefixed with "property_" are tested by Medusa
 */
contract RiseJackMedusaTest {
    RiseJack public risejack;
    AutoFulfillVRF public vrf;

    // Ghost variables for tracking
    uint256 public totalBetsPlaced;
    uint256 public totalPayouts;
    uint256 public gamesPlayed;

    constructor() payable {
        vrf = new AutoFulfillVRF();
        risejack = new RiseJack(address(vrf));
        vrf.setGame(address(risejack));

        // Fund the house
        payable(address(risejack)).transfer(100 ether);
    }

    // ==================== ACTIONS ====================

    function placeBet(
        uint256 amount
    ) external payable {
        amount = _bound(amount, risejack.minBet(), risejack.maxBet());

        RiseJack.Game memory game = risejack.getGameState(msg.sender);
        if (game.state != RiseJack.GameState.Idle) return;

        if (address(this).balance < amount) return;

        try risejack.placeBet{ value: amount }() {
            totalBetsPlaced += amount;
            gamesPlayed++;
        } catch { }
    }

    function hit() external {
        RiseJack.Game memory game = risejack.getGameState(msg.sender);
        if (game.state != RiseJack.GameState.PlayerTurn) return;

        try risejack.hit() { } catch { }
    }

    function stand() external {
        RiseJack.Game memory game = risejack.getGameState(msg.sender);
        if (game.state != RiseJack.GameState.PlayerTurn) return;

        try risejack.stand() { } catch { }
    }

    function surrender() external {
        RiseJack.Game memory game = risejack.getGameState(msg.sender);
        if (game.state != RiseJack.GameState.PlayerTurn) return;
        if (game.playerCards.length != 2) return;

        try risejack.surrender() { } catch { }
    }

    function doubleDown() external payable {
        RiseJack.Game memory game = risejack.getGameState(msg.sender);
        if (game.state != RiseJack.GameState.PlayerTurn) return;
        if (game.playerCards.length != 2) return;

        uint256 bet = game.bet;
        if (address(this).balance < bet) return;

        try risejack.double{ value: bet }() { } catch { }
    }

    // ==================== PROPERTY TESTS ====================

    /**
     * @notice Property: Hand value must be between 2 and 30
     */
    function property_handValueInRange(
        uint8 card1,
        uint8 card2
    ) external view returns (bool) {
        card1 = uint8(_bound(card1, 0, 51));
        card2 = uint8(_bound(card2, 0, 51));

        uint8[] memory cards = new uint8[](2);
        cards[0] = card1;
        cards[1] = card2;

        (uint8 value,) = risejack.calculateHandValue(cards);
        return value >= 2 && value <= 30;
    }

    /**
     * @notice Property: Soft hands cannot exceed 21
     */
    function property_softHandsNotOver21(
        uint8 card1,
        uint8 card2
    ) external view returns (bool) {
        card1 = uint8(_bound(card1, 0, 51));
        card2 = uint8(_bound(card2, 0, 51));

        uint8[] memory cards = new uint8[](2);
        cards[0] = card1;
        cards[1] = card2;

        (uint8 value, bool isSoft) = risejack.calculateHandValue(cards);
        if (isSoft) {
            return value <= 21;
        }
        return true;
    }

    /**
     * @notice Property: Contract balance can never go negative (always true, sanity check)
     */
    function property_balanceNonNegative() external view returns (bool) {
        return address(risejack).balance >= 0;
    }

    /**
     * @notice Property: Exposure must be reasonable relative to balance
     */
    function property_exposureReasonable() external view returns (bool) {
        uint256 exposure = risejack.totalExposure();
        uint256 balance = address(risejack).balance;
        // Exposure should not exceed 10x balance (sanity check)
        return exposure <= balance * 10 || balance == 0;
    }

    /**
     * @notice Property: Active games must have non-zero bet
     */
    function property_activeGamesHaveBet() external view returns (bool) {
        RiseJack.Game memory game = risejack.getGameState(msg.sender);
        if (game.state != RiseJack.GameState.Idle) {
            return game.bet > 0;
        }
        return true;
    }

    /**
     * @notice Property: Card info extraction is consistent
     */
    function property_cardInfoConsistent(
        uint8 card
    ) external view returns (bool) {
        card = uint8(_bound(card, 0, 51));
        (uint8 rank, uint8 suit) = risejack.getCardInfo(card);
        return rank < 13 && suit < 4;
    }

    // ==================== HELPERS ====================

    function _bound(
        uint256 value,
        uint256 min,
        uint256 max
    ) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    receive() external payable { }
}
