// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IVRFConsumer } from "./interfaces/IVRFConsumer.sol";
import { IVRFCoordinator } from "./interfaces/IVRFCoordinator.sol";

/**
 * @title RiseJack
 * @author edsphinx
 * @custom:company blocketh
 * @notice On-chain Blackjack game with provably fair randomness via Rise VRF
 * @dev Uses Rise Chain VRF for card dealing with async callback pattern
 *
 * SECURITY MODEL:
 * - Infinite Deck: Each card is dealt from a fresh virtual deck (random % 52).
 *   This is an INTENTIONAL DESIGN CHOICE to prevent card counting attacks.
 *   Unlike physical casinos, on-chain card counting with AI/bots is trivial.
 *   Infinite deck ensures each card is statistically independent.
 *
 * - House Edge: Standard blackjack rules give the house ~0.5% edge.
 *   Combined with the protections below, the house is mathematically favored.
 *
 * - Risk Management:
 *   1. Per-game limits: maxBet caps individual exposure
 *   2. Daily profit limits: Prevents lucky streaks from draining the house
 *   3. Reserve requirements: Auto-pause if house balance drops too low
 *   4. Circuit breaker: Emergency pause on anomalous losses
 *   5. Rate limiting: Prevents rapid-fire betting attacks
 */
contract RiseJack is IVRFConsumer {
    // ==================== CONSTANTS ====================

    /// @notice Rise Chain Testnet VRF Coordinator (default)
    address public constant DEFAULT_VRF_COORDINATOR = 0x9d57aB4517ba97349551C876a01a7580B1338909;

    /// @notice Cards per deck (infinite deck model - see security notes above)
    uint8 public constant CARDS_PER_DECK = 52;

    /// @notice Blackjack payout multiplier (3:2 = 150%)
    uint256 public constant BLACKJACK_PAYOUT = 150;

    /// @notice Standard win payout (1:1 = 200% of bet returned)
    uint256 public constant STANDARD_PAYOUT = 200;

    /// @notice Daily profit limit per player (prevents whale drain)
    uint256 public constant DEFAULT_DAILY_PROFIT_LIMIT = 10 ether;

    /// @notice Minimum house reserve before auto-pause
    uint256 public constant DEFAULT_MIN_RESERVE = 50 ether;

    /// @notice Circuit breaker: max loss in time window before pause
    uint256 public constant CIRCUIT_BREAKER_THRESHOLD = 20 ether;
    uint256 public constant CIRCUIT_BREAKER_WINDOW = 1 hours;

    /// @notice Game timeout - after this time, game can be cancelled
    uint256 public constant GAME_TIMEOUT = 1 hours;

    /// @notice Blackjack game constants
    uint8 public constant BLACKJACK_VALUE = 21;
    uint8 public constant DEALER_STAND_VALUE = 17;
    uint8 public constant ACE_HIGH_VALUE = 11;
    uint8 public constant ACE_LOW_VALUE = 1;
    uint8 public constant FACE_CARD_VALUE = 10;
    uint8 public constant RANKS_PER_SUIT = 13;
    uint8 public constant NUM_SUITS = 4;
    uint8 public constant MAX_DEALER_CARDS = 10;
    uint8 public constant MAX_DEALER_DRAW_ESTIMATE = 5;

    /// @notice VRF request timeout - after this, request can be retried
    uint256 public constant VRF_TIMEOUT = 5 minutes;

    /// @notice Cooldown between games per player (rate limiting)
    uint256 public constant GAME_COOLDOWN = 30 seconds;

    // ==================== STRUCTS ====================

    struct Game {
        address player;
        uint256 bet;
        uint8[] playerCards;
        uint8[] dealerCards;
        GameState state;
        uint256 timestamp;
        bool isDoubled; // Track if player doubled down
    }

    struct VRFRequest {
        address player;
        RequestType requestType;
        bool fulfilled;
        uint256 timestamp; // When the request was made
    }

    // ==================== ENUMS ====================

    enum GameState {
        Idle, // No active game
        WaitingForDeal, // Waiting for initial cards VRF
        PlayerTurn, // Player can hit/stand/double/surrender
        WaitingForHit, // Waiting for hit card VRF
        DealerTurn, // Dealer drawing cards
        PlayerWin, // Player won
        DealerWin, // Dealer won
        Push, // Tie
        PlayerBlackjack // Player got 21 on initial deal
    }

    enum RequestType {
        InitialDeal, // Request for 4 cards (2 player + 2 dealer)
        PlayerHit, // Request for 1 card (player hit)
        DealerDraw // Request for dealer cards
    }

    // ==================== EVENTS ====================

    event GameStarted(address indexed player, uint256 bet);
    event CardsRequested(address indexed player, uint256 requestId, RequestType requestType);
    event CardDealt(address indexed player, uint8 card, bool isDealer, bool faceUp);
    event PlayerAction(address indexed player, string action);
    event GameEnded(address indexed player, GameState result, uint256 payout);
    event HandValue(address indexed player, uint8 value, bool isSoft, bool isDealer);
    event PayoutFailed(address indexed player, uint256 amount);
    event Withdrawal(address indexed player, uint256 amount);

    // House protection events
    event ContractPaused(string reason);
    event ContractUnpaused();
    event DailyLimitReached(address indexed player, uint256 profit);
    event CircuitBreakerTriggered(uint256 lossAmount, uint256 timeWindow);
    event ReserveLow(uint256 currentBalance, uint256 minRequired);
    event GameTimedOut(address indexed player, uint256 refund);

    // Admin events
    event BetLimitsChanged(uint256 newMinBet, uint256 newMaxBet);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event DailyProfitLimitChanged(uint256 newLimit);
    event MinReserveChanged(uint256 newReserve);

    // VRF events
    event VRFRequestRetried(address indexed player, uint256 oldRequestId, uint256 newRequestId);
    event GameForceResolved(address indexed player, uint256 refund);

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

    /// @notice Pending withdrawals for failed payouts (Pull Payment pattern)
    mapping(address => uint256) public pendingWithdrawals;

    /// @notice Player nonces for VRF seed uniqueness
    mapping(address => uint256) public playerNonces;

    /// @notice Last game timestamp per player (for cooldown)
    mapping(address => uint256) public lastGameTimestamp;

    // ==================== HOUSE PROTECTION STATE ====================

    /// @notice Emergency pause flag
    bool public paused;

    /// @notice Daily profit tracking per player
    mapping(address => uint256) public dailyProfit;
    mapping(address => uint256) public lastProfitReset;

    /// @notice Configurable daily profit limit (default from constant)
    uint256 public dailyProfitLimit = DEFAULT_DAILY_PROFIT_LIMIT;

    /// @notice Minimum reserve before auto-pause
    uint256 public minReserve = DEFAULT_MIN_RESERVE;

    /// @notice Circuit breaker tracking
    uint256 public windowStartTime;
    uint256 public windowLosses;

    /// @notice Total active bets (exposure)
    uint256 public totalExposure;

    // ==================== MODIFIERS ====================

    modifier onlyVRFCoordinator() {
        require(msg.sender == address(coordinator), "Only VRF coordinator");
        _;
    }

    modifier gameInState(
        address player,
        GameState state
    ) {
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

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier checkReserve() {
        _;
        // After the function, check if we need to auto-pause
        if (address(this).balance < minReserve) {
            paused = true;
            emit ContractPaused("Reserve below minimum");
            emit ReserveLow(address(this).balance, minReserve);
        }
    }

    modifier checkDailyLimit(
        address player
    ) {
        // Reset daily tracking if new day
        if (block.timestamp - lastProfitReset[player] >= 1 days) {
            dailyProfit[player] = 0;
            lastProfitReset[player] = block.timestamp;
        }
        require(dailyProfit[player] < dailyProfitLimit, "Daily profit limit reached");
        _;
    }

    modifier checkCooldown(
        address player
    ) {
        require(block.timestamp >= lastGameTimestamp[player] + GAME_COOLDOWN, "Cooldown active");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    /**
     * @notice Deploy Blackjack contract
     * @param _vrfCoordinator Address of VRF Coordinator (use address(0) for default Rise testnet)
     */
    constructor(
        address _vrfCoordinator
    ) {
        // Dependency injection: use provided coordinator or default to Rise testnet
        if (_vrfCoordinator == address(0)) {
            coordinator = IVRFCoordinator(DEFAULT_VRF_COORDINATOR);
        } else {
            require(_vrfCoordinator.code.length > 0, "VRF must be contract");
            coordinator = IVRFCoordinator(_vrfCoordinator);
        }
        owner = msg.sender;
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * @notice Place a bet and start a new game
     * @dev Requests 4 random numbers for initial deal (2 player + 2 dealer)
     */
    function placeBet()
        external
        payable
        whenNotPaused
        validBet
        gameInState(msg.sender, GameState.Idle)
        checkDailyLimit(msg.sender)
        checkCooldown(msg.sender)
    {
        // Track cooldown
        lastGameTimestamp[msg.sender] = block.timestamp;

        // Track exposure (max possible payout)
        totalExposure += (msg.value * BLACKJACK_PAYOUT) / 100 + msg.value;

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

        // Request 4 random numbers for initial deal with improved seed
        uint256 nonce = playerNonces[msg.sender]++;
        uint256 seed =
            uint256(keccak256(abi.encode(msg.sender, block.timestamp, block.prevrandao, nonce)));
        uint256 requestId = coordinator.requestRandomNumbers(4, seed);

        vrfRequests[requestId] = VRFRequest({
            player: msg.sender,
            requestType: RequestType.InitialDeal,
            fulfilled: false,
            timestamp: block.timestamp
        });

        emit GameStarted(msg.sender, msg.value);
        emit CardsRequested(msg.sender, requestId, RequestType.InitialDeal);
    }

    /**
     * @notice Request another card (hit)
     */
    function hit() external gameInState(msg.sender, GameState.PlayerTurn) {
        games[msg.sender].state = GameState.WaitingForHit;

        uint256 nonce = playerNonces[msg.sender]++;
        uint256 seed = uint256(
            keccak256(
                abi.encode(msg.sender, block.timestamp, games[msg.sender].playerCards.length, nonce)
            )
        );
        uint256 requestId = coordinator.requestRandomNumbers(1, seed);

        vrfRequests[requestId] = VRFRequest({
            player: msg.sender,
            requestType: RequestType.PlayerHit,
            fulfilled: false,
            timestamp: block.timestamp
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

        // Track additional exposure for doubled bet
        // Original exposure was (bet * 2.5), new max is (2*bet * 2) = 4*bet
        // Additional exposure = 4*bet - 2.5*bet = 1.5*bet = msg.value * 3 / 2
        // But since we already tracked 2.5x, we need: new_total - old_total
        // new_total = bet*2*2 = 4*bet, old_total = bet*2.5, diff = 1.5*bet
        totalExposure += (msg.value * 3) / 2;

        uint256 nonce = playerNonces[msg.sender]++;
        uint256 seed = uint256(keccak256(abi.encode(msg.sender, block.timestamp, "double", nonce)));
        uint256 requestId = coordinator.requestRandomNumbers(1, seed);

        vrfRequests[requestId] = VRFRequest({
            player: msg.sender,
            requestType: RequestType.PlayerHit, // Will trigger dealer play after
            fulfilled: false,
            timestamp: block.timestamp
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

        // Reset game first (Checks-Effects-Interactions)
        _resetGame(msg.sender);

        // Send refund with Pull Payment fallback
        _safePayout(msg.sender, refund);
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

        // Validate game is in a valid state for this callback
        require(
            game.state == GameState.WaitingForDeal || game.state == GameState.WaitingForHit
                || game.state == GameState.DealerTurn,
            "Invalid game state for VRF callback"
        );

        if (request.requestType == RequestType.InitialDeal) {
            _handleInitialDeal(player, randomNumbers);
        } else if (request.requestType == RequestType.PlayerHit) {
            _handlePlayerHit(player, randomNumbers);
        } else if (request.requestType == RequestType.DealerDraw) {
            _handleDealerDraw(player, randomNumbers);
        }
    }

    // ==================== INTERNAL - DEAL HANDLING ====================

    function _handleInitialDeal(
        address player,
        uint256[] memory randomNumbers
    ) internal {
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
            _safePayout(player, payout);
        } else if (playerValue == 21) {
            // Player blackjack
            game.state = GameState.PlayerBlackjack;
            uint256 payout = (game.bet * BLACKJACK_PAYOUT) / 100 + game.bet;
            emit GameEnded(player, GameState.PlayerBlackjack, payout);
            _resetGame(player);
            _safePayout(player, payout);
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

    function _handlePlayerHit(
        address player,
        uint256[] memory randomNumbers
    ) internal {
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

    function _handleDealerDraw(
        address player,
        uint256[] memory randomNumbers
    ) internal {
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

    function _playDealer(
        address player
    ) internal {
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
            // Request cards for dealer with improved seed
            uint256 nonce = playerNonces[player]++;
            uint256 seed = uint256(keccak256(abi.encode(player, block.timestamp, "dealer", nonce)));
            uint256 requestId = coordinator.requestRandomNumbers(cardsNeeded, seed);

            vrfRequests[requestId] = VRFRequest({
                player: player,
                requestType: RequestType.DealerDraw,
                fulfilled: false,
                timestamp: block.timestamp
            });

            emit CardsRequested(player, requestId, RequestType.DealerDraw);
        } else {
            // Dealer stands - resolve immediately
            _resolveGame(player);
        }
    }

    function _resolveDealerHand(
        address player
    ) internal {
        Game storage game = games[player];

        (uint8 dealerValue, bool isSoft) = calculateHandValue(game.dealerCards);
        emit HandValue(player, dealerValue, isSoft, true);

        // Check if dealer needs more cards
        if (_shouldDealerHit(dealerValue, isSoft) && game.dealerCards.length < 10) {
            // Need more cards - request one more with improved seed
            uint256 nonce = playerNonces[player]++;
            uint256 seed = uint256(
                keccak256(abi.encode(player, block.timestamp, game.dealerCards.length, nonce))
            );
            uint256 requestId = coordinator.requestRandomNumbers(1, seed);

            vrfRequests[requestId] = VRFRequest({
                player: player,
                requestType: RequestType.DealerDraw,
                fulfilled: false,
                timestamp: block.timestamp
            });

            emit CardsRequested(player, requestId, RequestType.DealerDraw);
        } else {
            _resolveGame(player);
        }
    }

    function _shouldDealerHit(
        uint8 value,
        bool isSoft
    ) internal pure returns (bool) {
        // Dealer hits on 16 or less, and hits on soft 17
        if (value < 17) return true;
        if (value == 17 && isSoft) return true;
        return false;
    }

    function _resolveGame(
        address player
    ) internal checkReserve {
        Game storage game = games[player];

        (uint8 playerValue,) = calculateHandValue(game.playerCards);
        (uint8 dealerValue,) = calculateHandValue(game.dealerCards);

        uint256 payout = 0;
        uint256 bet = game.bet;

        if (dealerValue > 21) {
            // Dealer busted
            game.state = GameState.PlayerWin;
            payout = bet * 2;
        } else if (playerValue > dealerValue) {
            // Player wins
            game.state = GameState.PlayerWin;
            payout = bet * 2;
        } else if (dealerValue > playerValue) {
            // Dealer wins
            game.state = GameState.DealerWin;
            payout = 0;
        } else {
            // Push
            game.state = GameState.Push;
            payout = bet;
        }

        // Update exposure
        uint256 maxPayout = (bet * BLACKJACK_PAYOUT) / 100 + bet;
        if (totalExposure >= maxPayout) {
            totalExposure -= maxPayout;
        } else {
            totalExposure = 0;
        }

        // Track player profit and house loss for circuit breaker
        if (payout > bet) {
            uint256 profit = payout - bet;
            dailyProfit[player] += profit;

            // Check daily limit
            if (dailyProfit[player] >= dailyProfitLimit) {
                emit DailyLimitReached(player, dailyProfit[player]);
            }

            // Circuit breaker: track house losses
            _trackHouseLoss(profit);
        }

        emit GameEnded(player, game.state, payout);
        _resetGame(player);

        if (payout > 0) {
            _safePayout(player, payout);
        }
    }

    function _resetGame(
        address player
    ) internal {
        delete games[player];
    }

    /**
     * @notice Safe payout with Pull Payment fallback
     * @dev If direct transfer fails, stores in pendingWithdrawals
     * @param to Recipient address
     * @param amount Amount to pay
     */
    function _safePayout(
        address to,
        uint256 amount
    ) internal {
        (bool success,) = to.call{ value: amount }("");
        if (!success) {
            // If transfer fails, store for manual withdrawal
            pendingWithdrawals[to] += amount;
            emit PayoutFailed(to, amount);
        }
    }

    /**
     * @notice Track house losses for circuit breaker
     * @param lossAmount Amount the house lost this game
     */
    function _trackHouseLoss(
        uint256 lossAmount
    ) internal {
        // Reset window if expired
        if (block.timestamp - windowStartTime >= CIRCUIT_BREAKER_WINDOW) {
            windowStartTime = block.timestamp;
            windowLosses = 0;
        }

        windowLosses += lossAmount;

        // Trigger circuit breaker if threshold exceeded
        if (windowLosses >= CIRCUIT_BREAKER_THRESHOLD) {
            paused = true;
            emit CircuitBreakerTriggered(windowLosses, CIRCUIT_BREAKER_WINDOW);
            emit ContractPaused("Circuit breaker triggered");
        }
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * @notice Convert random number to card (0-51)
     * @param random The random number from VRF
     * @return Card value 0-51
     */
    function _randomToCard(
        uint256 random
    ) internal pure returns (uint8) {
        return uint8(random % CARDS_PER_DECK);
    }

    /**
     * @notice Calculate hand value
     * @param cards Array of card values (0-51)
     * @return value The hand value
     * @return isSoft Whether the hand is soft (ace counted as 11)
     */
    function calculateHandValue(
        uint8[] memory cards
    ) public pure returns (uint8 value, bool isSoft) {
        uint8 total = 0;
        uint8 aces = 0;
        uint256 len = cards.length; // Cache length

        for (uint256 i = 0; i < len;) {
            uint8 cardRank = cards[i] % RANKS_PER_SUIT; // 0=A, 1=2, ..., 12=K

            if (cardRank == 0) {
                // Ace
                unchecked {
                    aces++;
                }
                total += ACE_HIGH_VALUE;
            } else if (cardRank >= 10) {
                // Face cards (J, Q, K)
                total += FACE_CARD_VALUE;
            } else {
                // Number cards (2-10)
                unchecked {
                    total += cardRank + 1;
                }
            }
            unchecked {
                i++;
            }
        }

        // Adjust for aces if over 21
        while (total > BLACKJACK_VALUE && aces > 0) {
            unchecked {
                total -= 10;
                aces--;
            }
        }

        return (total, aces > 0 && total <= BLACKJACK_VALUE);
    }

    /**
     * @notice Get card display info
     * @param card Card value (0-51)
     * @return rank 0-12 (A, 2-10, J, Q, K)
     * @return suit 0-3 (Hearts, Diamonds, Clubs, Spades)
     */
    function getCardInfo(
        uint8 card
    ) external pure returns (uint8 rank, uint8 suit) {
        return (card % RANKS_PER_SUIT, card / RANKS_PER_SUIT);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get current game state for a player
     */
    function getGameState(
        address player
    ) external view returns (Game memory) {
        return games[player];
    }

    /**
     * @notice Get player's current hand value
     */
    function getPlayerHandValue(
        address player
    ) external view returns (uint8 value, bool isSoft) {
        return calculateHandValue(games[player].playerCards);
    }

    /**
     * @notice Get dealer's visible hand value (excludes hole card before reveal)
     */
    function getDealerVisibleValue(
        address player
    ) external view returns (uint8 value) {
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

    // ==================== PLAYER FUNCTIONS ====================

    /**
     * @notice Withdraw pending payouts
     * @dev Used when automatic payout fails (Pull Payment pattern)
     */
    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawal");

        pendingWithdrawals[msg.sender] = 0;
        emit Withdrawal(msg.sender, amount);

        (bool success,) = msg.sender.call{ value: amount }("");
        require(success, "Withdrawal failed");
    }

    /**
     * @notice Cancel a timed out game and refund the player
     * @dev Can be called by anyone for any player's timed out game
     * @param player Address of the player with timed out game
     */
    function cancelTimedOutGame(
        address player
    ) external {
        Game storage game = games[player];
        require(game.state != GameState.Idle, "No active game");
        require(block.timestamp >= game.timestamp + GAME_TIMEOUT, "Game not timed out");

        uint256 refund = game.bet;

        // Update exposure
        uint256 maxPayout = (refund * BLACKJACK_PAYOUT) / 100 + refund;
        if (totalExposure >= maxPayout) {
            totalExposure -= maxPayout;
        } else {
            totalExposure = 0;
        }

        emit GameTimedOut(player, refund);
        _resetGame(player);

        // Refund full bet using safe payout
        if (refund > 0) {
            _safePayout(player, refund);
        }
    }

    // ==================== VRF TIMEOUT FUNCTIONS ====================

    /**
     * @notice Retry a timed-out VRF request
     * @param requestId The request ID to retry
     * @dev Anyone can call this after VRF_TIMEOUT has passed
     */
    function retryVRFRequest(
        uint256 requestId
    ) external {
        VRFRequest storage request = vrfRequests[requestId];
        require(request.player != address(0), "Unknown request");
        require(!request.fulfilled, "Already fulfilled");
        require(block.timestamp >= request.timestamp + VRF_TIMEOUT, "Request not timed out");

        address player = request.player;
        RequestType requestType = request.requestType;

        // Mark old request as fulfilled to prevent reuse
        request.fulfilled = true;

        // Create new request based on type
        uint256 nonce = playerNonces[player]++;
        uint256 seed = uint256(keccak256(abi.encode(player, block.timestamp, "retry", nonce)));
        uint256 numNumbers;

        if (requestType == RequestType.InitialDeal) {
            numNumbers = 4;
        } else {
            numNumbers = 1;
        }

        uint256 newRequestId = coordinator.requestRandomNumbers(uint32(numNumbers), seed);

        vrfRequests[newRequestId] = VRFRequest({
            player: player, requestType: requestType, fulfilled: false, timestamp: block.timestamp
        });

        emit VRFRequestRetried(player, requestId, newRequestId);
        emit CardsRequested(player, newRequestId, requestType);
    }

    /**
     * @notice Force resolve a stuck game (admin only)
     * @param player The player whose game to force resolve
     * @dev Refunds full bet amount - use only for stuck games
     */
    function forceResolveGame(
        address player
    ) external onlyOwner {
        Game storage game = games[player];
        require(game.state != GameState.Idle, "No active game");

        // game.bet already contains total wagered (original + double if applicable)
        uint256 refund = game.bet;

        // Calculate exposure to remove based on bet amount
        uint256 exposureToRemove = (refund * BLACKJACK_PAYOUT) / 100 + refund;

        // Safely reduce exposure (cap at current exposure to avoid underflow)
        if (exposureToRemove > totalExposure) {
            totalExposure = 0;
        } else {
            totalExposure -= exposureToRemove;
        }

        emit GameForceResolved(player, refund);
        _resetGame(player);

        // Refund full bet
        if (refund > 0) {
            _safePayout(player, refund);
        }
    }

    // ==================== ADMIN FUNCTIONS ====================

    function setBetLimits(
        uint256 _minBet,
        uint256 _maxBet
    ) external onlyOwner {
        require(_minBet > 0, "Min bet must be positive");
        require(_maxBet > _minBet, "Max must exceed min");
        minBet = _minBet;
        maxBet = _maxBet;
        emit BetLimitsChanged(_minBet, _maxBet);
    }

    function withdrawHouseFunds(
        uint256 amount
    ) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        require(address(this).balance - amount >= minReserve, "Would breach min reserve");
        (bool success,) = owner.call{ value: amount }("");
        require(success, "Withdraw failed");
    }

    function transferOwnership(
        address newOwner
    ) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    // ==================== HOUSE PROTECTION ADMIN ====================

    /**
     * @notice Pause the contract (emergency stop)
     */
    function pause() external onlyOwner {
        paused = true;
        emit ContractPaused("Manual pause by owner");
    }

    /**
     * @notice Unpause the contract
     * @dev Only works if reserve is healthy
     */
    function unpause() external onlyOwner {
        require(address(this).balance >= minReserve, "Reserve too low to unpause");
        paused = false;
        // Reset circuit breaker
        windowLosses = 0;
        windowStartTime = block.timestamp;
        emit ContractUnpaused();
    }

    /**
     * @notice Set daily profit limit per player
     */
    function setDailyProfitLimit(
        uint256 _limit
    ) external onlyOwner {
        require(_limit > 0, "Limit must be positive");
        dailyProfitLimit = _limit;
        emit DailyProfitLimitChanged(_limit);
    }

    /**
     * @notice Set minimum house reserve
     */
    function setMinReserve(
        uint256 _reserve
    ) external onlyOwner {
        minReserve = _reserve;
        emit MinReserveChanged(_reserve);
    }

    /**
     * @notice Get current house stats
     */
    function getHouseStats()
        external
        view
        returns (
            uint256 balance,
            uint256 exposure,
            uint256 reserve,
            uint256 recentLosses,
            bool isPaused
        )
    {
        return (address(this).balance, totalExposure, minReserve, windowLosses, paused);
    }

    receive() external payable { }
}
