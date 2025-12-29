// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Blackjack
 * @author Rise Blackjack Team
 * @notice On-chain Blackjack game optimized for Rise Chain's 10ms blocks
 * @dev Implements commit-reveal for provably fair randomness
 */
contract Blackjack {
    // ==================== STRUCTS ====================

    struct Game {
        address player;
        uint256 bet;
        uint8[] playerCards;
        uint8[] dealerCards;
        GameState state;
        bytes32 commitHash;
        uint256 timestamp;
    }

    // ==================== ENUMS ====================

    enum GameState {
        Idle,
        WaitingForReveal,
        PlayerTurn,
        DealerTurn,
        PlayerWin,
        DealerWin,
        Push,
        Blackjack
    }

    // ==================== EVENTS ====================

    event GameStarted(address indexed player, uint256 bet, bytes32 commitHash);
    event CardDealt(address indexed player, uint8 card, bool isDealer);
    event PlayerAction(address indexed player, string action);
    event GameEnded(address indexed player, GameState result, uint256 payout);

    // ==================== STATE ====================

    mapping(address => Game) public games;
    uint256 public minBet = 0.001 ether;
    uint256 public maxBet = 1 ether;

    // ==================== MODIFIERS ====================

    modifier gameInState(address player, GameState state) {
        require(games[player].state == state, "Invalid game state");
        _;
    }

    modifier validBet() {
        require(msg.value >= minBet && msg.value <= maxBet, "Invalid bet amount");
        _;
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * @notice Place a bet and start a new game
     * @param commitHash Commit hash for provably fair randomness
     */
    function placeBet(bytes32 commitHash) external payable validBet gameInState(msg.sender, GameState.Idle) {
        games[msg.sender] = Game({
            player: msg.sender,
            bet: msg.value,
            playerCards: new uint8[](0),
            dealerCards: new uint8[](0),
            state: GameState.WaitingForReveal,
            commitHash: commitHash,
            timestamp: block.timestamp
        });

        emit GameStarted(msg.sender, msg.value, commitHash);
    }

    /**
     * @notice Request another card
     */
    function hit() external gameInState(msg.sender, GameState.PlayerTurn) {
        // TODO: Implement card dealing logic
        emit PlayerAction(msg.sender, "hit");
    }

    /**
     * @notice End player turn
     */
    function stand() external gameInState(msg.sender, GameState.PlayerTurn) {
        games[msg.sender].state = GameState.DealerTurn;
        emit PlayerAction(msg.sender, "stand");
        // TODO: Implement dealer logic
    }

    /**
     * @notice Double down - double bet, take one card, then stand
     */
    function double() external payable gameInState(msg.sender, GameState.PlayerTurn) {
        require(msg.value == games[msg.sender].bet, "Must match original bet");
        games[msg.sender].bet += msg.value;
        emit PlayerAction(msg.sender, "double");
        // TODO: Implement double logic
    }

    /**
     * @notice Surrender - forfeit half the bet
     */
    function surrender() external gameInState(msg.sender, GameState.PlayerTurn) {
        uint256 refund = games[msg.sender].bet / 2;
        games[msg.sender].state = GameState.DealerWin;
        
        (bool success, ) = msg.sender.call{value: refund}("");
        require(success, "Refund failed");
        
        emit PlayerAction(msg.sender, "surrender");
        emit GameEnded(msg.sender, GameState.DealerWin, refund);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get current game state for a player
     */
    function getGameState(address player) external view returns (Game memory) {
        return games[player];
    }

    /**
     * @notice Calculate hand value
     */
    function calculateHandValue(uint8[] memory cards) public pure returns (uint8 value, bool isSoft) {
        uint8 total = 0;
        uint8 aces = 0;

        for (uint256 i = 0; i < cards.length; i++) {
            uint8 cardValue = cards[i] % 13;
            if (cardValue == 0) {
                // Ace
                aces++;
                total += 11;
            } else if (cardValue >= 10) {
                // Face cards
                total += 10;
            } else {
                total += cardValue + 1;
            }
        }

        // Adjust for aces if over 21
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
        }

        return (total, aces > 0 && total <= 21);
    }

    // ==================== ADMIN FUNCTIONS ====================

    function setBetLimits(uint256 _minBet, uint256 _maxBet) external {
        // TODO: Add access control
        minBet = _minBet;
        maxBet = _maxBet;
    }

    receive() external payable {}
}
