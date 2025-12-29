// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IVRFConsumer} from "./interfaces/IVRFConsumer.sol";
import {IVRFCoordinator} from "./interfaces/IVRFCoordinator.sol";

/**
 * @title Blackjack
 * @author Rise Blackjack Team
 * @notice On-chain Blackjack game with provably fair randomness via Rise VRF
 * @dev Uses Rise Chain VRF for card dealing with async callback pattern
 */
contract Blackjack is IVRFConsumer {
    // ==================== CONSTANTS ====================

    /// @notice Rise Chain Testnet VRF Coordinator
    address public constant VRF_COORDINATOR = 0x9d57aB4517ba97349551C876a01a7580B1338909;

    /// @notice Cards per deck
    uint8 public constant CARDS_PER_DECK = 52;

    /// @notice Blackjack payout multiplier (3:2 = 150%)
    uint256 public constant BLACKJACK_PAYOUT = 150;

    /// @notice Standard win payout (1:1 = 200% of bet returned)
    uint256 public constant STANDARD_PAYOUT = 200;

    // ==================== STRUCTS ====================

    struct Game {
        address player;
        uint256 bet;
        uint8[] playerCards;
        uint8[] dealerCards;
        GameState state;
        uint256 timestamp;
        bool isDoubled;  // Track if player doubled down
    }

    struct VRFRequest {
        address player;
        RequestType requestType;
        bool fulfilled;
    }

    // ==================== ENUMS ====================

    enum GameState {
        Idle,           // No active game
        WaitingForDeal, // Waiting for initial cards VRF
        PlayerTurn,     // Player can hit/stand/double/surrender
        WaitingForHit,  // Waiting for hit card VRF
        DealerTurn,     // Dealer drawing cards
        PlayerWin,      // Player won
        DealerWin,      // Dealer won
        Push,           // Tie
        PlayerBlackjack // Player got 21 on initial deal
    }

    enum RequestType {
        InitialDeal,    // Request for 4 cards (2 player + 2 dealer)
        PlayerHit,      // Request for 1 card (player hit)
        DealerDraw      // Request for dealer cards
    }

    // ==================== EVENTS ====================

    event GameStarted(address indexed player, uint256 bet);
    event CardsRequested(address indexed player, uint256 requestId, RequestType requestType);
    event CardDealt(address indexed player, uint8 card, bool isDealer, bool faceUp);
    event PlayerAction(address indexed player, string action);
    event GameEnded(address indexed player, GameState result, uint256 payout);
    event HandValue(address indexed player, uint8 value, bool isSoft, bool isDealer);

    // ==================== STATE ====================

    /// @notice VRF Coordinator instance
    IVRFCoordinator public immutable coordinator;

    /// @notice Active games by player
    mapping(address => Game) public games;

    /// @notice VRF requests tracking
    mapping(uint256 => VRFRequest) public vrfRequests;

    /// @notice Bet limits
    uint256 public minBet = 0.001 ether;
    uint256 public maxBet = 1 ether;

    /// @notice Contract owner
    address public owner;

    // ==================== MODIFIERS ====================

    modifier onlyVRFCoordinator() {
        require(msg.sender == address(coordinator), "Only VRF coordinator");
        _;
    }

    modifier gameInState(address player, GameState state) {
        require(games[player].state == state, "Invalid game state");
        _;
    }

    modifier validBet() {
        require(msg.value >= minBet && msg.value <= maxBet, "Invalid bet amount");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor() {
        coordinator = IVRFCoordinator(VRF_COORDINATOR);
        owner = msg.sender;
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * @notice Place a bet and start a new game
     * @dev Requests 4 random numbers for initial deal (2 player + 2 dealer)
     */
    function placeBet() external payable validBet gameInState(msg.sender, GameState.Idle) {
        // Initialize game
        games[msg.sender] = Game({
            player: msg.sender,
            bet: msg.value,
            playerCards: new uint8[](0),
            dealerCards: new uint8[](0),
            state: GameState.WaitingForDeal,
            timestamp: block.timestamp,
            isDoubled: false
        });

        // Request 4 random numbers for initial deal
        uint256 seed = uint256(keccak256(abi.encode(msg.sender, block.timestamp, block.prevrandao)));
        uint256 requestId = coordinator.requestRandomNumbers(4, seed);

        vrfRequests[requestId] = VRFRequest({
            player: msg.sender,
            requestType: RequestType.InitialDeal,
            fulfilled: false
        });

        emit GameStarted(msg.sender, msg.value);
        emit CardsRequested(msg.sender, requestId, RequestType.InitialDeal);
    }

    /**
     * @notice Request another card (hit)
     */
    function hit() external gameInState(msg.sender, GameState.PlayerTurn) {
        games[msg.sender].state = GameState.WaitingForHit;

        uint256 seed = uint256(keccak256(abi.encode(msg.sender, block.timestamp, games[msg.sender].playerCards.length)));
        uint256 requestId = coordinator.requestRandomNumbers(1, seed);

        vrfRequests[requestId] = VRFRequest({
            player: msg.sender,
            requestType: RequestType.PlayerHit,
            fulfilled: false
        });

        emit PlayerAction(msg.sender, "hit");
        emit CardsRequested(msg.sender, requestId, RequestType.PlayerHit);
    }

    /**
     * @notice End player turn and let dealer play
     */
    function stand() external gameInState(msg.sender, GameState.PlayerTurn) {
        emit PlayerAction(msg.sender, "stand");
        _playDealer(msg.sender);
    }

    /**
     * @notice Double down - double bet, take one card, then stand
     */
    function double() external payable gameInState(msg.sender, GameState.PlayerTurn) {
        require(msg.value == games[msg.sender].bet, "Must match original bet");
        require(games[msg.sender].playerCards.length == 2, "Can only double on initial hand");

        games[msg.sender].bet += msg.value;
        games[msg.sender].isDoubled = true;
        games[msg.sender].state = GameState.WaitingForHit;

        uint256 seed = uint256(keccak256(abi.encode(msg.sender, block.timestamp, "double")));
        uint256 requestId = coordinator.requestRandomNumbers(1, seed);

        vrfRequests[requestId] = VRFRequest({
            player: msg.sender,
            requestType: RequestType.PlayerHit, // Will trigger dealer play after
            fulfilled: false
        });

        emit PlayerAction(msg.sender, "double");
        emit CardsRequested(msg.sender, requestId, RequestType.PlayerHit);
    }

    /**
     * @notice Surrender - forfeit half the bet
     */
    function surrender() external gameInState(msg.sender, GameState.PlayerTurn) {
        require(games[msg.sender].playerCards.length == 2, "Can only surrender on initial hand");

        uint256 refund = games[msg.sender].bet / 2;
        games[msg.sender].state = GameState.DealerWin;

        emit PlayerAction(msg.sender, "surrender");
        emit GameEnded(msg.sender, GameState.DealerWin, refund);

        // Reset game
        _resetGame(msg.sender);

        // Send refund
        (bool success,) = msg.sender.call{value: refund}("");
        require(success, "Refund failed");
    }

    // ==================== VRF CALLBACK ====================

    /**
     * @notice VRF callback - processes random numbers and deals cards
     * @param requestId The request ID
     * @param randomNumbers Array of random numbers from VRF
     */
    function rawFulfillRandomNumbers(
        uint256 requestId,
        uint256[] memory randomNumbers
    ) external override onlyVRFCoordinator {
        VRFRequest storage request = vrfRequests[requestId];
        require(request.player != address(0), "Unknown request");
        require(!request.fulfilled, "Already fulfilled");

        request.fulfilled = true;
        address player = request.player;
        Game storage game = games[player];

        if (request.requestType == RequestType.InitialDeal) {
            _handleInitialDeal(player, randomNumbers);
        } else if (request.requestType == RequestType.PlayerHit) {
            _handlePlayerHit(player, randomNumbers);
        } else if (request.requestType == RequestType.DealerDraw) {
            _handleDealerDraw(player, randomNumbers);
        }
    }

    // ==================== INTERNAL - DEAL HANDLING ====================

    function _handleInitialDeal(address player, uint256[] memory randomNumbers) internal {
        require(randomNumbers.length >= 4, "Need 4 random numbers");

        Game storage game = games[player];

        // Deal cards: Player1, Dealer1 (face up), Player2, Dealer2 (face down)
        uint8 playerCard1 = _randomToCard(randomNumbers[0]);
        uint8 dealerCard1 = _randomToCard(randomNumbers[1]);
        uint8 playerCard2 = _randomToCard(randomNumbers[2]);
        uint8 dealerCard2 = _randomToCard(randomNumbers[3]);

        game.playerCards.push(playerCard1);
        game.dealerCards.push(dealerCard1);
        game.playerCards.push(playerCard2);
        game.dealerCards.push(dealerCard2);

        emit CardDealt(player, playerCard1, false, true);
        emit CardDealt(player, dealerCard1, true, true);
        emit CardDealt(player, playerCard2, false, true);
        emit CardDealt(player, dealerCard2, true, false); // Dealer hole card face down

        // Check for blackjacks
        (uint8 playerValue,) = calculateHandValue(game.playerCards);
        (uint8 dealerValue,) = calculateHandValue(game.dealerCards);

        emit HandValue(player, playerValue, false, false);

        if (playerValue == 21 && dealerValue == 21) {
            // Both blackjack = push
            game.state = GameState.Push;
            uint256 payout = game.bet;
            emit GameEnded(player, GameState.Push, payout);
            _resetGame(player);
            (bool success,) = player.call{value: payout}("");
            require(success, "Payout failed");
        } else if (playerValue == 21) {
            // Player blackjack
            game.state = GameState.PlayerBlackjack;
            uint256 payout = (game.bet * BLACKJACK_PAYOUT) / 100 + game.bet;
            emit GameEnded(player, GameState.PlayerBlackjack, payout);
            _resetGame(player);
            (bool success,) = player.call{value: payout}("");
            require(success, "Payout failed");
        } else if (dealerValue == 21) {
            // Dealer blackjack
            game.state = GameState.DealerWin;
            emit CardDealt(player, dealerCard2, true, true); // Reveal hole card
            emit HandValue(player, dealerValue, false, true);
            emit GameEnded(player, GameState.DealerWin, 0);
            _resetGame(player);
        } else {
            // Normal play continues
            game.state = GameState.PlayerTurn;
        }
    }

    function _handlePlayerHit(address player, uint256[] memory randomNumbers) internal {
        require(randomNumbers.length >= 1, "Need 1 random number");

        Game storage game = games[player];
        uint8 newCard = _randomToCard(randomNumbers[0]);
        game.playerCards.push(newCard);

        emit CardDealt(player, newCard, false, true);

        (uint8 playerValue,) = calculateHandValue(game.playerCards);
        emit HandValue(player, playerValue, false, false);

        if (playerValue > 21) {
            // Player busted
            game.state = GameState.DealerWin;
            emit GameEnded(player, GameState.DealerWin, 0);
            _resetGame(player);
        } else if (playerValue == 21) {
            // Auto-stand on 21
            _playDealer(player);
        } else {
            // Check if this was a double
            if (game.isDoubled) {
                // Doubled - auto stand
                _playDealer(player);
            } else {
                game.state = GameState.PlayerTurn;
            }
        }
    }

    function _handleDealerDraw(address player, uint256[] memory randomNumbers) internal {
        Game storage game = games[player];

        // Add dealer cards
        for (uint256 i = 0; i < randomNumbers.length; i++) {
            uint8 newCard = _randomToCard(randomNumbers[i]);
            game.dealerCards.push(newCard);
            emit CardDealt(player, newCard, true, true);
        }

        _resolveDealerHand(player);
    }

    // ==================== INTERNAL - DEALER LOGIC ====================

    function _playDealer(address player) internal {
        Game storage game = games[player];
        game.state = GameState.DealerTurn;

        // Reveal hole card
        if (game.dealerCards.length >= 2) {
            emit CardDealt(player, game.dealerCards[1], true, true);
        }

        (uint8 dealerValue, bool isSoft) = calculateHandValue(game.dealerCards);
        emit HandValue(player, dealerValue, isSoft, true);

        // Count how many cards dealer needs
        uint8 cardsNeeded = 0;
        uint8 tempValue = dealerValue;
        bool tempSoft = isSoft;
        uint8[] memory tempCards = new uint8[](game.dealerCards.length);
        for (uint256 i = 0; i < game.dealerCards.length; i++) {
            tempCards[i] = game.dealerCards[i];
        }

        // Simulate dealer draws to determine count (max 5 additional cards)
        while (_shouldDealerHit(tempValue, tempSoft) && cardsNeeded < 5) {
            cardsNeeded++;
            // Estimate next value (assume average card ~7)
            tempValue += 7;
            if (tempValue > 21 && tempSoft) {
                tempValue -= 10;
                tempSoft = false;
            }
        }

        if (cardsNeeded > 0) {
            // Request cards for dealer
            uint256 seed = uint256(keccak256(abi.encode(player, block.timestamp, "dealer")));
            uint256 requestId = coordinator.requestRandomNumbers(cardsNeeded, seed);

            vrfRequests[requestId] = VRFRequest({
                player: player,
                requestType: RequestType.DealerDraw,
                fulfilled: false
            });

            emit CardsRequested(player, requestId, RequestType.DealerDraw);
        } else {
            // Dealer stands - resolve immediately
            _resolveGame(player);
        }
    }

    function _resolveDealerHand(address player) internal {
        Game storage game = games[player];

        (uint8 dealerValue, bool isSoft) = calculateHandValue(game.dealerCards);
        emit HandValue(player, dealerValue, isSoft, true);

        // Check if dealer needs more cards
        if (_shouldDealerHit(dealerValue, isSoft) && game.dealerCards.length < 10) {
            // Need more cards - request one more
            uint256 seed = uint256(keccak256(abi.encode(player, block.timestamp, game.dealerCards.length)));
            uint256 requestId = coordinator.requestRandomNumbers(1, seed);

            vrfRequests[requestId] = VRFRequest({
                player: player,
                requestType: RequestType.DealerDraw,
                fulfilled: false
            });

            emit CardsRequested(player, requestId, RequestType.DealerDraw);
        } else {
            _resolveGame(player);
        }
    }

    function _shouldDealerHit(uint8 value, bool isSoft) internal pure returns (bool) {
        // Dealer hits on 16 or less, and hits on soft 17
        if (value < 17) return true;
        if (value == 17 && isSoft) return true;
        return false;
    }

    function _resolveGame(address player) internal {
        Game storage game = games[player];

        (uint8 playerValue,) = calculateHandValue(game.playerCards);
        (uint8 dealerValue,) = calculateHandValue(game.dealerCards);

        uint256 payout = 0;

        if (dealerValue > 21) {
            // Dealer busted
            game.state = GameState.PlayerWin;
            payout = game.bet * 2;
        } else if (playerValue > dealerValue) {
            // Player wins
            game.state = GameState.PlayerWin;
            payout = game.bet * 2;
        } else if (dealerValue > playerValue) {
            // Dealer wins
            game.state = GameState.DealerWin;
            payout = 0;
        } else {
            // Push
            game.state = GameState.Push;
            payout = game.bet;
        }

        emit GameEnded(player, game.state, payout);
        _resetGame(player);

        if (payout > 0) {
            (bool success,) = player.call{value: payout}("");
            require(success, "Payout failed");
        }
    }

    function _resetGame(address player) internal {
        delete games[player];
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * @notice Convert random number to card (0-51)
     * @param random The random number from VRF
     * @return Card value 0-51
     */
    function _randomToCard(uint256 random) internal pure returns (uint8) {
        return uint8(random % CARDS_PER_DECK);
    }

    /**
     * @notice Calculate hand value
     * @param cards Array of card values (0-51)
     * @return value The hand value
     * @return isSoft Whether the hand is soft (ace counted as 11)
     */
    function calculateHandValue(uint8[] memory cards) public pure returns (uint8 value, bool isSoft) {
        uint8 total = 0;
        uint8 aces = 0;

        for (uint256 i = 0; i < cards.length; i++) {
            uint8 cardRank = cards[i] % 13; // 0=A, 1=2, ..., 12=K

            if (cardRank == 0) {
                // Ace
                aces++;
                total += 11;
            } else if (cardRank >= 10) {
                // Face cards (J, Q, K)
                total += 10;
            } else {
                // Number cards (2-10)
                total += cardRank + 1;
            }
        }

        // Adjust for aces if over 21
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
        }

        return (total, aces > 0 && total <= 21);
    }

    /**
     * @notice Get card display info
     * @param card Card value (0-51)
     * @return rank 0-12 (A, 2-10, J, Q, K)
     * @return suit 0-3 (Hearts, Diamonds, Clubs, Spades)
     */
    function getCardInfo(uint8 card) public pure returns (uint8 rank, uint8 suit) {
        return (card % 13, card / 13);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get current game state for a player
     */
    function getGameState(address player) external view returns (Game memory) {
        return games[player];
    }

    /**
     * @notice Get player's current hand value
     */
    function getPlayerHandValue(address player) external view returns (uint8 value, bool isSoft) {
        return calculateHandValue(games[player].playerCards);
    }

    /**
     * @notice Get dealer's visible hand value (excludes hole card before reveal)
     */
    function getDealerVisibleValue(address player) external view returns (uint8 value) {
        Game storage game = games[player];
        if (game.dealerCards.length == 0) return 0;

        // Only show first card if game is in PlayerTurn
        if (game.state == GameState.PlayerTurn || game.state == GameState.WaitingForHit) {
            uint8[] memory visibleCards = new uint8[](1);
            visibleCards[0] = game.dealerCards[0];
            (value,) = calculateHandValue(visibleCards);
        } else {
            (value,) = calculateHandValue(game.dealerCards);
        }
    }

    // ==================== ADMIN FUNCTIONS ====================

    function setBetLimits(uint256 _minBet, uint256 _maxBet) external onlyOwner {
        require(_minBet > 0, "Min bet must be positive");
        require(_maxBet > _minBet, "Max must exceed min");
        minBet = _minBet;
        maxBet = _maxBet;
    }

    function withdrawHouseFunds(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success,) = owner.call{value: amount}("");
        require(success, "Withdraw failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    receive() external payable {}
}
